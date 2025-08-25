import { StorageService } from "@/storage/StorageService";
import { type Product, type UUID } from "@/types/business";
import { productSchema } from "@/types/business";

function nowISO() { return new Date().toISOString(); }
function uuid(): UUID { return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID; }

export type NewProduct = Omit<Product, "id" | "created_at" | "updated_at"> & { id?: UUID };

export class ProductManager {
  constructor(private storage: StorageService) {}

  async addProduct(input: NewProduct) {
    // Required: name, SKU, price
    const draft: Product = {
      id: input.id ?? uuid(),
      name: input.name,
      sku: input.sku,
      barcode: input.barcode ?? null,
      category: input.category ?? null,
      cost_price: input.cost_price,
      selling_price: input.selling_price,
      current_stock: input.current_stock ?? 0,
      low_stock_threshold: input.low_stock_threshold ?? 0,
      created_at: nowISO(),
      updated_at: nowISO(),
    };

    const validation = productSchema.safeParse(draft);
    if (!validation.success) return { success: false, error: validation.error.message } as const;

    return this.storage.save<Product>("products", draft);
  }

  async editProduct(id: UUID, update: Partial<NewProduct>) {
    const existing = await this.storage.findById<Product>("products", id);
    if (!existing.success || !existing.data) return { success: false, error: "Product not found" } as const;

    const merged: Product = { ...existing.data, ...update, updated_at: nowISO() } as Product;
    const validation = productSchema.safeParse(merged);
    if (!validation.success) return { success: false, error: validation.error.message } as const;

    return this.storage.save<Product>("products", merged);
  }

  async updateStock(productId: UUID, delta: number) {
    const res = await this.storage.findById<Product>("products", productId);
    if (!res.success || !res.data) return { success: false, error: "Product not found" } as const;

    const next = { ...res.data, current_stock: (res.data.current_stock ?? 0) + delta, updated_at: nowISO() } as Product;
    if (next.current_stock < 0) return { success: false, error: "Insufficient stock" } as const;
    return this.storage.save<Product>("products", next);
  }

  async search(term: string) {
    const all = await this.storage.getAll<Product>("products");
    if (!all.success || !all.data) return { success: false, data: [] as Product[] } as const;
    const q = term.trim().toLowerCase();
    const results = all.data.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q)
    );
    return { success: true, data: results } as const;
  }

  async findBySKU(sku: string) {
    return this.storage.findByIndex<Product>("products", "sku", sku);
  }

  async findByBarcode(barcode: string) {
    return this.storage.findByIndex<Product>("products", "barcode", barcode);
  }

  async listCategories() {
    const all = await this.storage.getAll<Product>("products");
    if (!all.success || !all.data) return { success: true, data: [] as string[] } as const;
    const set = new Set<string>();
    all.data.forEach(p => { if (p.category) set.add(p.category); });
    return { success: true, data: Array.from(set).sort() } as const;
  }

  async filterByCategory(category: string) {
    const all = await this.storage.getAll<Product>("products");
    if (!all.success || !all.data) return { success: true, data: [] as Product[] } as const;
    return { success: true, data: all.data.filter(p => p.category === category) } as const;
  }

  async lowStockAlerts() {
    const all = await this.storage.getAll<Product>("products");
    if (!all.success || !all.data) return { success: true, data: [] as Product[] } as const;
    const alerts = all.data.filter(p => (p.low_stock_threshold ?? 0) > 0 && p.current_stock <= (p.low_stock_threshold ?? 0));
    return { success: true, data: alerts } as const;
  }

  async importProducts(drafts: NewProduct[]) {
    const now = nowISO();
    const items = drafts.map(d => ({
      id: d.id ?? uuid(),
      name: d.name,
      sku: d.sku,
      barcode: d.barcode ?? null,
      category: d.category ?? null,
      cost_price: d.cost_price,
      selling_price: d.selling_price,
      current_stock: d.current_stock ?? 0,
      low_stock_threshold: d.low_stock_threshold ?? 0,
      created_at: now,
      updated_at: now,
    }));
    return this.storage.saveMany<Product>("products", items);
  }
}
