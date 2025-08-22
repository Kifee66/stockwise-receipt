import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Package, TrendingUp, DollarSign, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { Dashboard } from "./shop/Dashboard";
import { Restocking } from "./shop/Restocking";
import { Sales } from "./shop/Sales";
import { Reports } from "./shop/Reports";

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  
  // Sample data for demonstration
  const [products] = useState<Product[]>([
    {
      id: "1",
      name: "Premium Coffee Beans",
      category: "Beverages",
      currentStock: 25,
      lowStockThreshold: 10,
      costPrice: 8.50,
      sellingPrice: 15.00,
      lastRestocked: new Date(2024, 7, 20)
    },
    {
      id: "2", 
      name: "Organic Green Tea",
      category: "Beverages",
      currentStock: 5,
      lowStockThreshold: 15,
      costPrice: 4.00,
      sellingPrice: 8.50,
      lastRestocked: new Date(2024, 7, 18)
    },
    {
      id: "3",
      name: "Artisan Chocolate",
      category: "Confectionery",
      currentStock: 40,
      lowStockThreshold: 20,
      costPrice: 3.25,
      sellingPrice: 6.99,
      lastRestocked: new Date(2024, 7, 22)
    }
  ]);

  const [sales] = useState<Sale[]>([
    {
      id: "1",
      productId: "1",
      productName: "Premium Coffee Beans",
      quantity: 3,
      unitPrice: 15.00,
      totalAmount: 45.00,
      profit: 19.50,
      date: new Date(2024, 7, 21)
    },
    {
      id: "2",
      productId: "3", 
      productName: "Artisan Chocolate",
      quantity: 5,
      unitPrice: 6.99,
      totalAmount: 34.95,
      profit: 18.70,
      date: new Date(2024, 7, 21)
    }
  ]);

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