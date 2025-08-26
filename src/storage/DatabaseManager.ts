import type { StoreName } from "@/types/business";

export interface QuotaEstimate {
  usage?: number;
  quota?: number;
  usageDetails?: Record<string, number>;
}

export class DatabaseManager {
  private dbName: string;
  private version: number;
  private db: IDBDatabase | null = null;

  constructor(clientId: string, version = 1) {
    this.dbName = `shop_db_${clientId}`;
    this.version = version;
  }

  get name() {
    return this.dbName;
  }

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = (event.oldVersion ?? 0);
        // Create stores if not exist; handle future migrations by version
        if (oldVersion < 1) {
          // products
          const products = db.createObjectStore("products", { keyPath: "id" });
          products.createIndex("sku", "sku", { unique: true });
          products.createIndex("barcode", "barcode", { unique: false });
          products.createIndex("name", "name", { unique: false });
          products.createIndex("category", "category", { unique: false });
          products.createIndex("created_at", "created_at", { unique: false });
          products.createIndex("updated_at", "updated_at", { unique: false });

          // sales
          const sales = db.createObjectStore("sales", { keyPath: "id" });
          sales.createIndex("date", "date", { unique: false });
          sales.createIndex("payment_method", "payment_method", { unique: false });
          sales.createIndex("staff_id", "staff_id", { unique: false });
          sales.createIndex("status", "status", { unique: false });

          // stock_movements
          const stock = db.createObjectStore("stock_movements", { keyPath: "id" });
          stock.createIndex("date", "date", { unique: false });
          stock.createIndex("product_id", "product_id", { unique: false });
          stock.createIndex("type", "type", { unique: false });
          stock.createIndex("supplier_id", "supplier_id", { unique: false });

          // staff
          const staff = db.createObjectStore("staff", { keyPath: "id" });
          staff.createIndex("email", "email", { unique: true });
          staff.createIndex("role", "role", { unique: false });

          // business_settings
          const settings = db.createObjectStore("business_settings", { keyPath: "id" });
          settings.createIndex("business_name", "business_name", { unique: false });
          settings.createIndex("updated_at", "updated_at", { unique: false });

          // audit_logs
          const auditLogs = db.createObjectStore("audit_logs", { keyPath: "id" });
          auditLogs.createIndex("timestamp", "timestamp", { unique: false });
          auditLogs.createIndex("action", "action", { unique: false });
          auditLogs.createIndex("entity_type", "entity_type", { unique: false });
          auditLogs.createIndex("entity_id", "entity_id", { unique: false });
          auditLogs.createIndex("staff_id", "staff_id", { unique: false });

          // counters
          const counters = db.createObjectStore("counters", { keyPath: "id" });
          counters.createIndex("last_updated", "last_updated", { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          // If version change occurs elsewhere, close gracefully
          this.db?.close();
          this.db = null;
        };
        resolve(this.db);
      };

      request.onerror = () => {
        const err = request.error;
        if (err && (err.name === "QuotaExceededError" || err.name.includes("Quota"))) {
          reject(new Error("Storage quota exceeded. Please free up space and try again."));
        } else {
          reject(err ?? new Error("Failed to open database"));
        }
      };

      request.onblocked = () => {
        // Another tab may be blocking the upgrade
        console.warn("Database upgrade blocked. Close other tabs using this app.");
      };
    });
  }

  async withStore<T>(store: StoreName, mode: IDBTransactionMode, fn: (os: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      try {
        const tx = db.transaction(store, mode);
        const os = tx.objectStore(store);
        const req = fn(os);

        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => {
          const err = req.error;
          if (err && (err.name === "QuotaExceededError" || err.name.includes("Quota"))) {
            reject(new Error("Storage quota exceeded while performing operation."));
          } else {
            reject(err ?? new Error("IndexedDB operation failed"));
          }
        };
      } catch (e: any) {
        if (e?.name === "QuotaExceededError" || String(e?.name).includes("Quota")) {
          reject(new Error("Storage quota exceeded while starting transaction."));
        } else {
          reject(e);
        }
      }
    });
  }

  async estimateQuota(): Promise<QuotaEstimate> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        // @ts-ignore - some browsers return usageDetails
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          usageDetails: (estimate as any).usageDetails,
        };
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  async destroy(): Promise<void> {
    await this.close();
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(this.dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("Failed to delete database"));
    });
  }
}
