import { StorageService } from "@/storage/StorageService";
import type { Product, Sale, StockMovement, Staff, BusinessSettings } from "@/types/business";

export interface BackupBundle {
  products: Product[];
  sales: Sale[];
  stock_movements: StockMovement[];
  staff: Staff[];
  business_settings: BusinessSettings[];
  generated_at: string; // ISO
}

export async function aggregateAllData(storage: StorageService): Promise<BackupBundle> {
  const [products, sales, stock, staff, settings] = await Promise.all([
    storage.getAll<Product>("products"),
    storage.getAll<Sale>("sales"),
    storage.getAll<StockMovement>("stock_movements"),
    storage.getAll<Staff>("staff"),
    storage.getAll<BusinessSettings>("business_settings"),
  ]);

  return {
    products: products.data ?? [],
    sales: sales.data ?? [],
    stock_movements: stock.data ?? [],
    staff: staff.data ?? [],
    business_settings: settings.data ?? [],
    generated_at: new Date().toISOString(),
  };
}

export async function compressBackup(bundle: BackupBundle): Promise<Blob> {
  // Placeholder compression: JSON -> Blob. Future: add real compression (e.g., CompressionStream)
  const json = JSON.stringify(bundle);
  return new Blob([json], { type: "application/json" });
}
