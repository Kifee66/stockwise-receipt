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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  lowStockThreshold: number;
  costPrice: number;
  sellingPrice: number;
  lastRestocked?: Date;
}

interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  profit: number;
  date: Date;
}

interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  type: 'restock' | 'sale';
  date: Date;
  notes?: string;
}

export const ShopTracker = () => {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  // Fetch products from Supabase
  const fetchProducts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      const transformedProducts: Product[] = data.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category || 'Uncategorized',
        currentStock: p.current_stock,
        lowStockThreshold: p.low_stock_threshold,
        costPrice: Number(p.cost_price),
        sellingPrice: Number(p.selling_price),
        lastRestocked: p.last_restocked ? new Date(p.last_restocked) : undefined
      }));
      
      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Fetch sales from Supabase
  const fetchSales = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      const transformedSales: Sale[] = data.map(s => ({
        id: s.id,
        productId: s.product_id,
        productName: s.product_name,
        quantity: s.quantity,
        unitPrice: Number(s.unit_price),
        totalAmount: Number(s.total_amount),
        profit: Number(s.profit),
        date: new Date(s.date)
      }));
      
      setSales(transformedSales);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        title: "Error",
        description: "Failed to load sales data. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Load data when user is authenticated
  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setLoading(true);
        await Promise.all([fetchProducts(), fetchSales()]);
        setLoading(false);
      };
      
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

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
    sum + (product.currentStock * product.costPrice), 0
  );
  
  const todaysSales = sales.filter(sale => 
    sale.date.toDateString() === new Date().toDateString()
  ).reduce((sum, sale) => sum + sale.totalAmount, 0);
  
  const todaysProfit = sales.filter(sale => 
    sale.date.toDateString() === new Date().toDateString()
  ).reduce((sum, sale) => sum + sale.profit, 0);

  const lowStockProducts = products.filter(product => 
    product.currentStock <= product.lowStockThreshold
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-md mx-auto flex items-center justify-center">
        <Card className="shadow-receipt">
          <CardContent className="p-6 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-bold mb-2">Shop Tracker</h2>
            <p className="text-muted-foreground mb-4">
              Please sign in to access your shop data and manage your inventory.
            </p>
            <Button onClick={() => toast({
              title: "Authentication Required",
              description: "Please implement authentication to continue.",
            })}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                <p className="font-receipt text-lg font-semibold">${totalValue.toFixed(2)}</p>
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
                <p className="font-receipt text-lg font-semibold text-success">${todaysSales.toFixed(2)}</p>
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
                  <span className="font-receipt text-warning">{product.currentStock} left</span>
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
            products={products}
            sales={sales}
            totalValue={totalValue}
            todaysSales={todaysSales}
            todaysProfit={todaysProfit}
          />
        </TabsContent>

        <TabsContent value="restock">
          <Restocking products={products} />
        </TabsContent>

        <TabsContent value="sales">
          <Sales products={products} />
        </TabsContent>

        <TabsContent value="reports">
          <Reports sales={sales} />
        </TabsContent>
      </Tabs>
    </div>
  );
};