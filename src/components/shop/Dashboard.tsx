import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Package2, AlertTriangle, Clock } from "lucide-react";

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

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  totalValue: number;
  todaysSales: number;
  todaysProfit: number;
}

export const Dashboard = ({ products, sales, totalValue, todaysSales, todaysProfit }: DashboardProps) => {
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => p.currentStock <= p.lowStockThreshold).length;
  
  // Get recent sales (last 5)
  const recentSales = sales.slice(-5).reverse();
  
  // Calculate stock health percentage
  const healthyStockCount = products.filter(p => p.currentStock > p.lowStockThreshold).length;
  const stockHealthPercentage = totalProducts > 0 ? (healthyStockCount / totalProducts) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="shadow-receipt">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              Today's Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Sales Revenue</span>
              <span className="font-receipt font-semibold text-success">${todaysSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Profit Earned</span>
              <span className="font-receipt font-semibold text-success">${todaysProfit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-xs text-muted-foreground">Total Inventory</span>
              <span className="font-receipt font-semibold">${totalValue.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Health */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package2 className="w-4 h-4 text-primary" />
            Stock Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Overall Health</span>
            <span className="font-receipt">{stockHealthPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={stockHealthPercentage} className="h-2" />
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center">
              <p className="font-receipt text-lg font-semibold">{totalProducts}</p>
              <p className="text-xs text-muted-foreground">Total Items</p>
            </div>
            <div className="text-center">
              <p className="font-receipt text-lg font-semibold text-warning">{lowStockCount}</p>
              <p className="text-xs text-muted-foreground">Low Stock</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSales.length > 0 ? (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                  <div>
                    <p className="text-sm font-medium">{sale.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.quantity} × ${sale.unitPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-receipt font-semibold text-success">${sale.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.date.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No sales recorded yet</p>
          )}
        </CardContent>
      </Card>

      {/* Product List with Stock Levels */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Current Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {products.map((product) => (
              <div key={product.id} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{product.name}</p>
                    {product.currentStock <= product.lowStockThreshold && (
                      <AlertTriangle className="w-3 h-3 text-warning" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={product.currentStock <= product.lowStockThreshold ? "destructive" : "secondary"}
                    className="font-receipt text-xs"
                  >
                    {product.currentStock} in stock
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${(product.currentStock * product.costPrice).toFixed(2)} value
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};