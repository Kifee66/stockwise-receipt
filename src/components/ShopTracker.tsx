import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Package, TrendingUp, DollarSign, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { Dashboard } from "./shop/Dashboard";
import { Restocking } from "./shop/Restocking";
import { Sales } from "./shop/Sales";
import { Reports } from "./shop/Reports";
import { useShopData } from "@/hooks/useShopData";
import { StockManager } from "@/managers/StockManager";
import { DatabaseManager } from "@/storage/DatabaseManager";
import { StorageService } from "@/storage/StorageService";
import { useToast } from "@/hooks/use-toast";

// Get client ID for IndexedDB
const getClientId = () => {
  let clientId = localStorage.getItem('shop_client_id');
  if (!clientId) {
    clientId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('shop_client_id', clientId);
  }
  return clientId;
};

export const ShopTracker = () => {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [stockManager, setStockManager] = useState<StockManager | null>(null);
  
  // Use our custom hook for shop data
  const { products, sales, loading, productManager, salesManager, refreshData } = useShopData();
  
  // Initialize stock manager
  useEffect(() => {
    const initStockManager = async () => {
      try {
        const clientId = getClientId();
        const dbManager = new DatabaseManager(clientId);
        const storageService = new StorageService(dbManager);
        const stockMgr = new StockManager(storageService);
        setStockManager(stockMgr);
      } catch (error) {
        console.error('Failed to initialize stock manager:', error);
      }
    };

    initStockManager();
  }, []);

  // Listen for network status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calculate metrics
  const totalValue = products.reduce((sum, product) => 
    sum + (product.current_stock * product.cost_price), 0
  );
  
  const todaysSales = sales.filter(sale => {
    const saleDate = new Date(sale.date);
    const today = new Date();
    return saleDate.toDateString() === today.toDateString();
  }).reduce((sum, sale) => sum + sale.total_amount, 0);
  
  const todaysProfit = sales.filter(sale => {
    const saleDate = new Date(sale.date);
    const today = new Date();
    return saleDate.toDateString() === today.toDateString();
  }).reduce((sum, sale) => {
    const profit = sale.items.reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.product_id);
      const costPerItem = product ? product.cost_price : 0;
      return itemSum + ((item.unit_price - costPerItem) * item.quantity);
    }, 0);
    return sum + profit;
  }, 0);

  const lowStockProducts = products.filter(product => 
    product.current_stock <= (product.low_stock_threshold || 0)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-md mx-auto flex items-center justify-center">
        <div className="text-center">
          <Package className="w-8 h-8 animate-pulse mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Loading shop data...</p>
        </div>
      </div>
    );
  }

  // No auth required for IndexedDB version

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      {/* Header with sync status */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shop Tracker</h1>
          <p className="text-sm text-muted-foreground">Stock & Sales Management</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isOnline ? "default" : "secondary"} className="gap-1">
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
          {pendingSyncs > 0 && (
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              {pendingSyncs} pending
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="shadow-receipt">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Inventory Value</p>
                <p className="font-receipt text-lg font-semibold">KSh {totalValue.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-receipt">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">Today's Sales</p>
                <p className="font-receipt text-lg font-semibold text-success">KSh {todaysSales.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <Card className="mb-6 border-warning/20 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <span className="text-sm font-semibold text-warning">Low Stock Alert</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {lowStockProducts.length} item(s) need restocking
            </p>
            <div className="space-y-1">
              {lowStockProducts.map(product => (
                <div key={product.id} className="flex justify-between text-xs">
                  <span>{product.name}</span>
                  <span className="font-receipt text-warning">{product.current_stock} left</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Navigation Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50">
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="restock" className="text-xs">Restock</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs">Sales</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <Dashboard 
            products={products.map(p => ({
              id: p.id,
              name: p.name,
              category: p.category || "",
              currentStock: p.current_stock,
              lowStockThreshold: p.low_stock_threshold || 0,
              costPrice: p.cost_price,
              sellingPrice: p.selling_price,
              lastRestocked: undefined
            }))}
            sales={sales.map(s => ({
              id: s.id,
              productId: s.items[0]?.product_id || "",
              productName: s.items[0]?.product_name || "",
              quantity: s.items.reduce((sum, item) => sum + item.quantity, 0),
              unitPrice: s.total_amount / s.items.reduce((sum, item) => sum + item.quantity, 1),
              totalAmount: s.total_amount,
              profit: s.items.reduce((sum, item) => {
                const product = products.find(p => p.id === item.product_id);
                const costPerItem = product ? product.cost_price : 0;
                return sum + ((item.unit_price - costPerItem) * item.quantity);
              }, 0),
              date: new Date(s.date)
            }))}
            totalValue={totalValue}
            todaysSales={todaysSales}
            todaysProfit={todaysProfit}
          />
        </TabsContent>

        <TabsContent value="restock">
          {productManager && stockManager ? (
            <Restocking 
              products={products} 
              productManager={productManager}
              stockManager={stockManager}
              onProductsChange={refreshData}
            />
          ) : (
            <Card className="shadow-receipt">
              <CardContent className="p-6 text-center">
                <Package className="w-8 h-8 animate-pulse mx-auto mb-2 text-primary" />
                <p className="text-muted-foreground">Initializing stock management...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sales">
          <Sales products={products.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category || "",
            currentStock: p.current_stock,
            lowStockThreshold: p.low_stock_threshold || 0,
            costPrice: p.cost_price,
            sellingPrice: p.selling_price,
            lastRestocked: undefined
          }))} />
        </TabsContent>

        <TabsContent value="reports">
          <Reports sales={sales.map(s => ({
            id: s.id,
            productId: s.items[0]?.product_id || "",
            productName: s.items[0]?.product_name || "",
            quantity: s.items.reduce((sum, item) => sum + item.quantity, 0),
            unitPrice: s.total_amount / s.items.reduce((sum, item) => sum + item.quantity, 1),
            totalAmount: s.total_amount,
            profit: s.items.reduce((sum, item) => {
              const product = products.find(p => p.id === item.product_id);
              const costPerItem = product ? product.cost_price : 0;
              return sum + ((item.unit_price - costPerItem) * item.quantity);
            }, 0),
            date: new Date(s.date)
          }))} />
        </TabsContent>
      </Tabs>
    </div>
  );
};