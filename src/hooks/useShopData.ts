import { useState, useEffect, useCallback } from "react";
import { ProductManager } from "@/managers/ProductManager";
import { SalesManager } from "@/managers/SalesManager";
import { DatabaseManager } from "@/storage/DatabaseManager";
import { StorageService } from "@/storage/StorageService";
import { type Product, type Sale } from "@/types/business";
import { useToast } from "@/hooks/use-toast";

// Generate a simple client ID for IndexedDB (in real app, this would be user-specific)
const getClientId = () => {
  let clientId = localStorage.getItem('shop_client_id');
  if (!clientId) {
    clientId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('shop_client_id', clientId);
  }
  return clientId;
};

export const useShopData = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [productManager, setProductManager] = useState<ProductManager | null>(null);
  const [salesManager, setSalesManager] = useState<SalesManager | null>(null);

  // Initialize managers
  useEffect(() => {
    const initializeManagers = async () => {
      try {
        const clientId = getClientId();
        const dbManager = new DatabaseManager(clientId);
        const storageService = new StorageService(dbManager);
        
        const prodManager = new ProductManager(storageService);
        const salesMgr = new SalesManager(storageService, prodManager);
        
        setProductManager(prodManager);
        setSalesManager(salesMgr);
        
        // Load initial data
        await loadProducts(prodManager);
        await loadSales(salesMgr);
      } catch (error) {
        console.error('Failed to initialize managers:', error);
        toast({
          title: "Initialization Error",
          description: "Failed to initialize data storage. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeManagers();
  }, [toast]);

  const loadProducts = useCallback(async (manager?: ProductManager) => {
    const mgr = manager || productManager;
    if (!mgr) return;

    try {
      const result = await mgr.search(""); // Get all products
      if (result.success) {
        setProducts(result.data);
      } else {
        console.error('Failed to load products:', result.data);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }, [productManager]);

  const loadSales = useCallback(async (manager?: SalesManager) => {
    const mgr = manager || salesManager;
    if (!mgr) return;

    try {
      const result = await mgr.salesByDateRange(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
        new Date().toISOString()
      );
      if (result.success) {
        setSales(result.data);
      } else {
        console.error('Failed to load sales:', result.data);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  }, [salesManager]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadProducts(), loadSales()]);
  }, [loadProducts, loadSales]);

  return {
    products,
    sales,
    loading,
    productManager,
    salesManager,
    refreshData,
    loadProducts,
    loadSales,
  };
};