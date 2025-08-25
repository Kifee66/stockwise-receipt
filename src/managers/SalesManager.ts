import { StorageService } from "@/storage/StorageService";
import { type Sale, type SaleItem, type Product, type UUID, type PaymentMethod, receiptSchema } from "@/types/business";
import { ProductManager } from "@/managers/ProductManager";

function uuid(): UUID { return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID; }
function nowISO() { return new Date().toISOString(); }

export class SalesManager {
  constructor(private storage: StorageService, private products: ProductManager) {}

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
    };

    // Deduct stock atomically-ish (best effort in single-thread)
    for (const it of items) {
      const dec = await this.products.updateStock(it.product_id, -it.quantity);
      if (!dec.success) return { success: false, error: `Stock update failed for ${it.product_name}` } as const;
    }

    const saved = await this.storage.save<Sale>("sales", sale);
    if (!saved.success || !saved.data) return saved;

    const receipt = {
      id: uuid(),
      sale_id: sale.id,
      number: `R-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      issued_at: sale.date,
      total: sale.total_amount,
      payment_method: sale.payment_method,
    };

    const parse = receiptSchema.safeParse(receipt);
    if (parse.success) {
      sale.receipt = receipt;
      await this.storage.save<Sale>("sales", sale);
    }

    return { success: true, data: sale } as const;
  }

  async salesByDateRange(fromISO: string, toISO: string) {
    return this.storage.queryDateRange<Sale>("sales", fromISO, toISO);
  }

  async dailySummary(dateISO: string) {
    const from = new Date(dateISO);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);
    const res = await this.salesByDateRange(from.toISOString(), to.toISOString());
    if (!res.success || !res.data) return { success: true, data: { total: 0, count: 0 } } as const;
    const total = res.data.reduce((s, x) => s + x.total_amount, 0);
    return { success: true, data: { total, count: res.data.length } } as const;
  }

  async monthlySummary(year: number, monthIndex0: number) {
    const from = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0));
    const to = new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59, 999));
    const res = await this.salesByDateRange(from.toISOString(), to.toISOString());
    if (!res.success || !res.data) return { success: true, data: { total: 0, count: 0 } } as const;
    const total = res.data.reduce((s, x) => s + x.total_amount, 0);
    return { success: true, data: { total, count: res.data.length } } as const;
  }
}
