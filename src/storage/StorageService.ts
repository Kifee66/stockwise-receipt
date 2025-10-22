import { type StoreName } from "@/types/business";
import { z, type ZodTypeAny } from "zod";
import { DatabaseManager } from "@/storage/DatabaseManager";
import {
  productSchema,
  saleSchema,
  stockMovementSchema,
  staffSchema,
  settingsSchema,
} from "@/types/business";

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const schemaMap: Partial<Record<StoreName, ZodTypeAny>> = {
  products: productSchema,
  sales: saleSchema,
  stock_movements: stockMovementSchema,
  staff: staffSchema,
  business_settings: settingsSchema,
};

export class StorageService {
  constructor(private db: DatabaseManager) {}

  private validate<T>(store: StoreName, payload: unknown): ServiceResponse<T> {
    const schema = schemaMap[store];
    if (!schema) return { success: true, data: payload };
    const parsed = (schema as ZodTypeAny).safeParse(payload as unknown);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors.map(e => e.message).join(", ") };
    }
    return { success: true, data: parsed.data };
  }

  async save<T>(store: StoreName, item: unknown): Promise<ServiceResponse<T>> {
    const validation = this.validate<T>(store, item);
    if (!validation.success) return validation;

    try {
      await this.db.withStore<IDBValidKey>(store, "readwrite", (os) => os.put(item));
      return { success: true, data: item as T };
    } catch (e: unknown) {
      const err = e as Error;
      return { success: false, error: err?.message ?? "Failed to save" };
    }
  }

  async saveMany<T>(store: StoreName, items: unknown[]): Promise<ServiceResponse<T[]>> {
    // Validate all first for atomicity-like behavior
    for (const item of items) {
      const v = this.validate<T>(store, item);
      if (!v.success) return { success: false, error: v.error };
    }
    try {
      const db = await this.db.open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const os = tx.objectStore(store);
        for (const item of items) os.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Batch save failed"));
      });
      return { success: true, data: items as unknown as T[] };
    } catch (e: unknown) {
      const err = e as Error;
      return { success: false, error: err?.message ?? "Failed to save batch" };
    }
  }

  async findById<T>(store: StoreName, id: string): Promise<ServiceResponse<T | undefined>> {
    try {
      const data = await this.db.withStore<T | undefined>(store, "readonly", (os) => os.get(id));
      return { success: true, data };
    } catch (e: unknown) {
      const err = e as Error;
      return { success: false, error: err?.message ?? "Failed to find" };
    }
  }

  async findByIndex<T>(store: StoreName, index: string, key: IDBValidKey | IDBKeyRange): Promise<ServiceResponse<T[]>> {
    try {
      const data = await this.db.withStore<T[]>(store, "readonly", (os) => os.index(index).getAll(key));
      return { success: true, data };
    } catch (e: unknown) {
      const err = e as Error;
      return { success: false, error: err?.message ?? "Failed to query index" };
    }
  }

  async queryDateRange<T>(store: StoreName, fromISO: string, toISO: string): Promise<ServiceResponse<T[]>> {
    const range = IDBKeyRange.bound(fromISO, toISO);
    return this.findByIndex<T>(store, "date", range);
  }

  async getAll<T>(store: StoreName): Promise<ServiceResponse<T[]>> {
    try {
      const data = await this.db.withStore<T[]>(store, "readonly", (os) => os.getAll());
      return { success: true, data };
    } catch (e: unknown) {
      const err = e as Error;
      return { success: false, error: err?.message ?? "Failed to get all" };
    }
  }

  async delete(store: StoreName, id: string): Promise<ServiceResponse<true>> {
    try {
      await this.db.withStore(store, "readwrite", (os) => os.delete(id));
      return { success: true, data: true };
    } catch (e: unknown) {
      const err = e as Error;
      return { success: false, error: err?.message ?? "Failed to delete" };
    }
  }

  async deleteMany(store: StoreName, ids: string[]): Promise<ServiceResponse<true>> {
    try {
      const db = await this.db.open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const os = tx.objectStore(store);
        for (const id of ids) os.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Batch delete failed"));
      });
      return { success: true, data: true };
    } catch (e: unknown) {
      const err = e as Error;
      return { success: false, error: err?.message ?? "Failed to delete batch" };
    }
  }
}
