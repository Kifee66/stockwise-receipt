import { useState, useEffect, useCallback } from "react";
import { DatabaseManager } from "@/storage/DatabaseManager";
import { StorageService } from "@/storage/StorageService";
import { ProductManager } from "@/managers/ProductManager";
import { SalesManager } from "@/managers/SalesManager";
import { StockManager } from "@/managers/StockManager";
import { StaffManager } from "@/managers/StaffManager";
import { SettingsManager } from "@/managers/SettingsManager";
import { AuditManager } from "@/managers/AuditManager";
import { CounterManager } from "@/managers/CounterManager";
import { 
  loadSnapshotFromLocalStorage, 
  restoreFromSnapshot, 
  aggregateAllData, 
  saveSnapshotToLocalStorage 
} from "@/utils/backup";
import { useToast } from "@/hooks/use-toast";

export interface OfflineManagers {
  storage: StorageService;
  products: ProductManager;
  sales: SalesManager;
  stock: StockManager;
  staff: StaffManager;
  settings: SettingsManager;
  audit: AuditManager;
  counters: CounterManager;
}

export function useOfflineFirst(clientId: string = "default") {
  const { toast } = useToast();
  const [managers, setManagers] = useState<OfflineManagers | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Initialize managers
  const initializeManagers = useCallback(async () => {
    try {
      const dbManager = new DatabaseManager(clientId);
      const storage = new StorageService(dbManager);
      
      // Test database connection
      await storage.getAll("products");
      
      const audit = new AuditManager(storage);
      const counters = new CounterManager(storage);
      const products = new ProductManager(storage);
      const stock = new StockManager(storage);
      const staff = new StaffManager(storage);
      const settings = new SettingsManager(storage);
      const sales = new SalesManager(storage, products, audit, counters);

      const managersObj: OfflineManagers = {
        storage,
        products,
        sales,
        stock,
        staff,
        settings,
        audit,
        counters,
      };

      setManagers(managersObj);
      setNeedsRecovery(false);
      
      return managersObj;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }, [clientId]);

  // Auto-recovery logic
  const attemptAutoRecovery = useCallback(async () => {
    console.log('Attempting auto-recovery...');
    
    // Try to restore from local backups in order
    const backupKeys: Array<'latest' | 'prev1' | 'prev2'> = ['latest', 'prev1', 'prev2'];
    
    for (const key of backupKeys) {
      try {
        const snapshot = await loadSnapshotFromLocalStorage(key);
        if (snapshot) {
          console.log(`Restoring from ${key} backup:`, snapshot.timestamp);
          
          // Initialize managers first
          const managersObj = await initializeManagers();
          
          // Restore from snapshot
          await restoreFromSnapshot(managersObj.storage, snapshot);
          
          toast({
            title: "Database Restored",
            description: `Restored from backup: ${new Date(snapshot.timestamp).toLocaleString()}`,
          });
          
          return true;
        }
      } catch (error) {
        console.warn(`Failed to restore from ${key}:`, error);
        continue;
      }
    }
    
    return false;
  }, [initializeManagers, toast]);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      
      try {
        await initializeManagers();
      } catch (error) {
        console.error('Database initialization failed, attempting recovery:', error);
        
        // Try auto-recovery
        const recovered = await attemptAutoRecovery();
        
        if (!recovered) {
          console.log('Auto-recovery failed, showing recovery screen');
          setNeedsRecovery(true);
        }
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [initializeManagers, attemptAutoRecovery]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Could trigger sync operations here in the future
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Service worker message handling
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_OPPORTUNITY' && managers) {
          // Future: trigger sync with cloud when available
          console.log('Sync opportunity detected');
        }
      });
    }
  }, [managers]);

  // Manual recovery function
  const forceRecovery = useCallback(async () => {
    setLoading(true);
    setNeedsRecovery(false);
    
    try {
      await initializeManagers();
    } catch (error) {
      setNeedsRecovery(true);
    } finally {
      setLoading(false);
    }
  }, [initializeManagers]);

  // Create backup manually
  const createBackup = useCallback(async () => {
    if (!managers) return;
    
    try {
      const snapshot = await aggregateAllData(managers.storage);
      await saveSnapshotToLocalStorage(snapshot);
      toast({
        title: "Backup Created",
        description: "Local backup has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Backup Failed",
        description: error instanceof Error ? error.message : "Failed to create backup",
        variant: "destructive",
      });
    }
  }, [managers, toast]);

  return {
    managers,
    loading,
    needsRecovery,
    isOnline,
    forceRecovery,
    createBackup,
  };
}