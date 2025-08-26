import { StorageService } from "@/storage/StorageService";
import { type Sale, type SaleItem, type Product, type UUID, type PaymentMethod, receiptSchema, type BusinessSettings } from "@/types/business";
import { ProductManager } from "@/managers/ProductManager";
import { AuditManager } from "@/managers/AuditManager";
import { CounterManager } from "@/managers/CounterManager";
import { debouncedBackup } from "@/utils/backup";

function uuid(): UUID { return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID; }
function nowISO() { return new Date().toISOString(); }

export class SalesManager {
  constructor(
    private storage: StorageService, 
    private products: ProductManager,
    private audit: AuditManager,
    private counters: CounterManager
  ) {}

  private calcTotals(items: SaleItem[]) {
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    return { total };
  }

  async recordSale(params: {
    items: Array<{ product: Product; quantity: number; price?: number }>;
    payment_method: PaymentMethod;
    staff_id?: UUID;
    customer?: { id?: UUID; name?: string; phone?: string } | null;
  }) {
    if (!params.items.length) return { success: false, error: "No items in sale" } as const;

    const items: SaleItem[] = params.items.map(({ product, quantity, price }) => ({
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: price ?? product.selling_price,
      subtotal: (price ?? product.selling_price) * quantity,
    }));

    const { total } = this.calcTotals(items);

    const sale: Sale = {
      id: uuid(),
      date: nowISO(),
      items,
      total_amount: total,
      payment_method: params.payment_method,
      staff_id: params.staff_id ?? null,
      customer: params.customer ?? null,
      receipt: null,
      status: "completed",
    };

    // Deduct stock atomically-ish (best effort in single-thread)
    for (const it of items) {
      const dec = await this.products.updateStock(it.product_id, -it.quantity);
      if (!dec.success) return { success: false, error: `Stock update failed for ${it.product_name}` } as const;
    }

    const saved = await this.storage.save<Sale>("sales", sale);
    if (!saved.success || !saved.data) return saved;

    // Generate receipt number using counter
    const receiptNumber = await this.counters.increment("receipts");
    const receiptNum = receiptNumber.success ? receiptNumber.data : Math.floor(Math.random() * 1000000);
    const receipt = {
      id: uuid(),
      sale_id: sale.id,
      number: `R-${String(receiptNum).padStart(6, '0')}`,
      issued_at: sale.date,
      total: sale.total_amount,
      payment_method: sale.payment_method,
    };

    const parse = receiptSchema.safeParse(receipt);
    if (parse.success) {
      sale.receipt = receipt;
      await this.storage.save<Sale>("sales", sale);
    }

    // Log sale action
    await this.audit.logAction({
      action: "sale_recorded",
      entity_type: "sale",
      entity_id: sale.id,
      staff_id: params.staff_id,
      metadata: { total: sale.total_amount, items_count: items.length }
    });

    // Trigger backup
    debouncedBackup(this.storage);

    return { success: true, data: sale } as const;
  }

  async salesByDateRange(fromISO: string, toISO: string, includeReversed = false) {
    const result = await this.storage.queryDateRange<Sale>("sales", fromISO, toISO);
    if (!result.success || !result.data) return result;
    
    if (!includeReversed) {
      const filtered = result.data.filter(sale => sale.status === "completed");
      return { success: true, data: filtered } as const;
    }
    
    return result;
  }

  async dailySummary(dateISO: string) {
    const from = new Date(dateISO);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);
    const res = await this.salesByDateRange(from.toISOString(), to.toISOString(), false); // exclude reversed
    if (!res.success || !res.data) return { success: true, data: { total: 0, count: 0 } } as const;
    const total = res.data.reduce((s, x) => s + x.total_amount, 0);
    return { success: true, data: { total, count: res.data.length } } as const;
  }

  async monthlySummary(year: number, monthIndex0: number) {
    const from = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0));
    const to = new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59, 999));
    const res = await this.salesByDateRange(from.toISOString(), to.toISOString(), false); // exclude reversed
    if (!res.success || !res.data) return { success: true, data: { total: 0, count: 0 } } as const;
    const total = res.data.reduce((s, x) => s + x.total_amount, 0);
    return { success: true, data: { total, count: res.data.length } } as const;
  }

  async canReverseSale(saleId: UUID): Promise<boolean> {
    const sale = await this.storage.findById<Sale>("sales", saleId);
    if (!sale.success || !sale.data || sale.data.status === "reversed") return false;
    
    // Get reversal window from settings
    const settings = await this.storage.getAll<BusinessSettings>("business_settings");
    const reversalWindow = settings.success && settings.data?.length > 0 
      ? settings.data[0].reversal_window_hours 
      : 24; // default 24 hours
    
    const saleDate = new Date(sale.data.date);
    const now = new Date();
    const hoursDiff = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff <= reversalWindow;
  }

  async reverseSale(saleId: UUID, reason?: string, staffId?: UUID): Promise<{ success: true; data: Sale } | { success: false; error: string }> {
    // Check if reversal is allowed
    const canReverse = await this.canReverseSale(saleId);
    if (!canReverse) {
      return { success: false, error: "Sale cannot be reversed - outside allowed time window or already reversed" };
    }

    const sale = await this.storage.findById<Sale>("sales", saleId);
    if (!sale.success || !sale.data) {
      return { success: false, error: "Sale not found" };
    }

    // Start atomic transaction - update sale status
    const reversedSale: Sale = {
      ...sale.data,
      status: "reversed"
    };

    const savedSale = await this.storage.save<Sale>("sales", reversedSale);
    if (!savedSale.success) {
      return { success: false, error: "Failed to update sale status" };
    }

    // Reverse stock changes (add back to inventory)
    for (const item of sale.data.items) {
      const stockUpdate = await this.products.updateStock(item.product_id, item.quantity);
      if (!stockUpdate.success) {
        // Rollback - restore sale status
        await this.storage.save<Sale>("sales", sale.data);
        return { success: false, error: `Failed to reverse stock for ${item.product_name}` };
      }
    }

    // Log the reversal action
    await this.audit.logAction({
      action: "sale_reversed",
      entity_type: "sale", 
      entity_id: saleId,
      staff_id: staffId,
      reason,
      metadata: { 
        original_total: sale.data.total_amount,
        items_count: sale.data.items.length,
        original_date: sale.data.date
      }
    });

    // Trigger backup
    debouncedBackup(this.storage);

    return { success: true, data: reversedSale };
  }
}
