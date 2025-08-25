import { StorageService } from "@/storage/StorageService";
import { type StockMovement, type UUID, type StockMovementType } from "@/types/business";

function nowISO() { return new Date().toISOString(); }
function uuid(): UUID { return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID; }

export class StockManager {
  constructor(private storage: StorageService) {}

  async logMovement(input: Omit<StockMovement, "id" | "date"> & { date?: string }) {
    const movement: StockMovement = {
      id: uuid(),
      date: input.date ?? nowISO(),
      notes: input.notes ?? null,
      supplier_id: input.supplier_id ?? null,
      product_id: input.product_id,
      quantity: input.quantity,
      type: input.type as StockMovementType,
    };
    return this.storage.save<StockMovement>("stock_movements", movement);
  }

  async byProduct(product_id: UUID) {
    return this.storage.findByIndex<StockMovement>("stock_movements", "product_id", product_id);
  }

  async byDateRange(fromISO: string, toISO: string) {
    return this.storage.queryDateRange<StockMovement>("stock_movements", fromISO, toISO);
  }

  async listSuppliers() {
    const res = await this.storage.getAll<StockMovement>("stock_movements");
    if (!res.success || !res.data) return { success: true, data: [] as UUID[] } as const;
    const set = new Set<UUID>();
    res.data.forEach(m => { if (m.supplier_id) set.add(m.supplier_id); });
    return { success: true, data: Array.from(set) } as const;
  }
}
