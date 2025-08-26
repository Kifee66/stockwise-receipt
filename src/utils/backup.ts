import { StorageService } from "@/storage/StorageService";
import type { 
  Product, 
  Sale, 
  StockMovement, 
  Staff, 
  BusinessSettings, 
  AuditLog, 
  AppCounter, 
  BackupSnapshot 
} from "@/types/business";

const BACKUP_VERSION = "1.0.0";
const SCHEMA_VERSION = 1;

// LocalStorage keys for rotating backups
const BACKUP_KEYS = {
  latest: "shop.backup.latest",
  prev1: "shop.backup.prev1", 
  prev2: "shop.backup.prev2",
  info: "shop.backup.info"
} as const;

export interface BackupInfo {
  lastBackup?: string;
  backupCount: number;
  totalSize: number;
}

let backupTimeout: NodeJS.Timeout | null = null;

export async function aggregateAllData(storage: StorageService): Promise<BackupSnapshot> {
  const [products, sales, stock, staff, settings, auditLogs, counters] = await Promise.all([
    storage.getAll<Product>("products"),
    storage.getAll<Sale>("sales"),
    storage.getAll<StockMovement>("stock_movements"),
    storage.getAll<Staff>("staff"),
    storage.getAll<BusinessSettings>("business_settings"),
    storage.getAll<AuditLog>("audit_logs"),
    storage.getAll<AppCounter>("counters"),
  ]);

  const tables = {
    products: products.data ?? [],
    sales: sales.data ?? [],
    stock_movements: stock.data ?? [],
    staff: staff.data ?? [],
    business_settings: settings.data ?? [],
    audit_logs: auditLogs.data ?? [],
    counters: counters.data ?? [],
  };

  const countersMap: Record<string, number> = {};
  tables.counters.forEach(c => countersMap[c.id] = c.value);

  const snapshot: BackupSnapshot = {
    schemaVersion: SCHEMA_VERSION,
    backupVersion: BACKUP_VERSION,
    timestamp: new Date().toISOString(),
    counters: countersMap,
    tables,
    checksum: "",
  };

  // Calculate checksum
  snapshot.checksum = await calculateChecksum(snapshot);
  return snapshot;
}

export async function calculateChecksum(snapshot: Omit<BackupSnapshot, 'checksum'>): Promise<string> {
  const dataString = JSON.stringify(snapshot);
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  
  if (crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback simple hash for environments without crypto.subtle
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

export async function validateBackupChecksum(snapshot: BackupSnapshot): Promise<boolean> {
  const storedChecksum = snapshot.checksum;
  const { checksum, ...dataToCheck } = snapshot;
  const calculatedChecksum = await calculateChecksum(dataToCheck);
  return storedChecksum === calculatedChecksum;
}

export async function saveSnapshotToLocalStorage(snapshot: BackupSnapshot): Promise<void> {
  try {
    const compressed = await compressBackup(snapshot);
    const dataUrl = await blobToBase64(compressed);
    
    // Rotate backups
    const prev1 = localStorage.getItem(BACKUP_KEYS.latest);
    if (prev1) {
      const prev2 = localStorage.getItem(BACKUP_KEYS.prev1);
      if (prev2) {
        localStorage.setItem(BACKUP_KEYS.prev2, prev2);
      }
      localStorage.setItem(BACKUP_KEYS.prev1, prev1);
    }
    
    // Save new backup
    localStorage.setItem(BACKUP_KEYS.latest, dataUrl);
    
    // Update backup info
    const info: BackupInfo = {
      lastBackup: snapshot.timestamp,
      backupCount: getBackupCount(),
      totalSize: getTotalBackupSize(),
    };
    localStorage.setItem(BACKUP_KEYS.info, JSON.stringify(info));
    
    console.log('Backup saved to LocalStorage:', snapshot.timestamp);
  } catch (error) {
    console.error('Failed to save backup to LocalStorage:', error);
    throw error;
  }
}

export async function loadSnapshotFromLocalStorage(key: keyof typeof BACKUP_KEYS = 'latest'): Promise<BackupSnapshot | null> {
  try {
    const dataUrl = localStorage.getItem(BACKUP_KEYS[key]);
    if (!dataUrl) return null;
    
    const compressed = await base64ToBlob(dataUrl);
    const snapshot = await decompressBackup(compressed);
    
    // Validate checksum
    const isValid = await validateBackupChecksum(snapshot);
    if (!isValid) {
      console.warn(`Backup checksum validation failed for ${key}`);
      return null;
    }
    
    return snapshot;
  } catch (error) {
    console.error(`Failed to load backup from ${key}:`, error);
    return null;
  }
}

export async function restoreFromSnapshot(storage: StorageService, snapshot: BackupSnapshot): Promise<void> {
  console.log('Restoring from backup:', snapshot.timestamp);
  
  // Clear existing data first
  await clearAllStores(storage);
  
  // Restore data
  const { tables } = snapshot;
  
  await Promise.all([
    tables.products.length > 0 ? storage.saveMany("products", tables.products) : Promise.resolve(),
    tables.sales.length > 0 ? storage.saveMany("sales", tables.sales) : Promise.resolve(),
    tables.stock_movements.length > 0 ? storage.saveMany("stock_movements", tables.stock_movements) : Promise.resolve(),
    tables.staff.length > 0 ? storage.saveMany("staff", tables.staff) : Promise.resolve(),
    tables.business_settings.length > 0 ? storage.saveMany("business_settings", tables.business_settings) : Promise.resolve(),
    tables.audit_logs.length > 0 ? storage.saveMany("audit_logs", tables.audit_logs) : Promise.resolve(),
    tables.counters.length > 0 ? storage.saveMany("counters", tables.counters) : Promise.resolve(),
  ]);
  
  console.log('Restore completed');
}

async function clearAllStores(storage: StorageService): Promise<void> {
  const stores = ["products", "sales", "stock_movements", "staff", "business_settings", "audit_logs", "counters"] as const;
  
  for (const store of stores) {
    const all = await storage.getAll(store);
    if (all.success && all.data) {
      const ids = all.data.map((item: any) => item.id);
      if (ids.length > 0) {
        await storage.deleteMany(store, ids);
      }
    }
  }
}

export async function compressBackup(snapshot: BackupSnapshot): Promise<Blob> {
  const json = JSON.stringify(snapshot);
  
  // Use CompressionStream if available
  if ('CompressionStream' in window) {
    try {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(new TextEncoder().encode(json));
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      return new Blob(chunks, { type: "application/gzip" });
    } catch (error) {
      console.warn('Compression failed, using uncompressed backup:', error);
    }
  }
  
  // Fallback to uncompressed
  return new Blob([json], { type: "application/json" });
}

export async function decompressBackup(blob: Blob): Promise<BackupSnapshot> {
  // Try decompression first
  if (blob.type === "application/gzip" && 'DecompressionStream' in window) {
    try {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(await blob.arrayBuffer());
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const decompressed = new TextDecoder().decode(new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [] as number[])));
      return JSON.parse(decompressed);
    } catch (error) {
      console.warn('Decompression failed, trying as JSON:', error);
    }
  }
  
  // Fallback to JSON parsing
  const text = await blob.text();
  return JSON.parse(text);
}

export async function debouncedBackup(storage: StorageService): Promise<void> {
  if (backupTimeout) {
    clearTimeout(backupTimeout);
  }
  
  backupTimeout = setTimeout(async () => {
    try {
      const snapshot = await aggregateAllData(storage);
      await saveSnapshotToLocalStorage(snapshot);
    } catch (error) {
      console.error('Debounced backup failed:', error);
    }
  }, 3000); // 3 second delay
}

export function getBackupInfo(): BackupInfo {
  try {
    const info = localStorage.getItem(BACKUP_KEYS.info);
    return info ? JSON.parse(info) : { backupCount: 0, totalSize: 0 };
  } catch {
    return { backupCount: 0, totalSize: 0 };
  }
}

function getBackupCount(): number {
  let count = 0;
  if (localStorage.getItem(BACKUP_KEYS.latest)) count++;
  if (localStorage.getItem(BACKUP_KEYS.prev1)) count++;
  if (localStorage.getItem(BACKUP_KEYS.prev2)) count++;
  return count;
}

function getTotalBackupSize(): number {
  let size = 0;
  const latest = localStorage.getItem(BACKUP_KEYS.latest);
  const prev1 = localStorage.getItem(BACKUP_KEYS.prev1);
  const prev2 = localStorage.getItem(BACKUP_KEYS.prev2);
  
  if (latest) size += latest.length;
  if (prev1) size += prev1.length;
  if (prev2) size += prev2.length;
  
  return size;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function base64ToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export async function exportBackupFile(storage: StorageService): Promise<void> {
  const snapshot = await aggregateAllData(storage);
  const compressed = await compressBackup(snapshot);
  
  const url = URL.createObjectURL(compressed);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shop-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackupFile(storage: StorageService, file: File): Promise<void> {
  const snapshot = await decompressBackup(file);
  
  const isValid = await validateBackupChecksum(snapshot);
  if (!isValid) {
    throw new Error('Backup file checksum validation failed');
  }
  
  await restoreFromSnapshot(storage, snapshot);
}