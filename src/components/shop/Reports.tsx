import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Download, Calendar as CalendarIcon, TrendingUp, DollarSign, Package } from "lucide-react";
import { format } from "date-fns";

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

interface ReportsProps {
  sales: Sale[];
}

export const Reports = ({ sales }: ReportsProps) => {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<string>("weekly");
  const [selectedDate, setSelectedDate] = useState<Date>();

  // Calculate report data based on type
  const getReportData = () => {
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (reportType) {
      case "daily":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = weekStart;
        break;
      case "monthly":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const filteredSales = sales.filter(sale => 
      sale.date >= startDate && sale.date <= endDate
    );

    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalProfit = filteredSales.reduce((sum, sale) => sum + sale.profit, 0);
    const totalQuantity = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0);
    const averageOrder = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

    // Top selling products
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    
    filteredSales.forEach(sale => {
      if (productSales[sale.productId]) {
        productSales[sale.productId].quantity += sale.quantity;
        productSales[sale.productId].revenue += sale.totalAmount;
      } else {
        productSales[sale.productId] = {
          name: sale.productName,
          quantity: sale.quantity,
          revenue: sale.totalAmount
        };
      }
    });

    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      periodName: reportType.charAt(0).toUpperCase() + reportType.slice(1),
      startDate,
      endDate,
      totalRevenue,
      totalProfit,
      totalQuantity,
      averageOrder,
      totalOrders: filteredSales.length,
      topProducts,
      sales: filteredSales
    };
  };

  const reportData = getReportData();

  const exportToPDF = () => {
    toast({
      title: "Export Coming Soon",
      description: "PDF export functionality will be available soon",
    });
  };

  const emailReport = () => {
    toast({
      title: "Email Coming Soon", 
      description: "Auto-email reports will be available soon",
    });
  };

  return (
    <div className="space-y-4">
      {/* Report Controls */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Sales Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Today</SelectItem>
                <SelectItem value="weekly">This Week</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <CalendarIcon className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="text-xs text-muted-foreground">
            {reportData.periodName} Report • {format(reportData.startDate, "MMM d")} - {format(reportData.endDate, "MMM d, yyyy")}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-receipt">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="font-receipt text-lg font-semibold text-success">
                  ${reportData.totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-receipt">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Profit</p>
                <p className="font-receipt text-lg font-semibold text-primary">
                  ${reportData.totalProfit.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Performance Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="font-receipt text-2xl font-bold">{reportData.totalOrders}</p>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </div>
            <div className="text-center">
              <p className="font-receipt text-2xl font-bold">{reportData.totalQuantity}</p>
              <p className="text-xs text-muted-foreground">Items Sold</p>
            </div>
          </div>
          
          <div className="pt-3 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Average Order Value</span>
              <span className="font-receipt font-semibold">${reportData.averageOrder.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Profit Margin</span>
              <span className="font-receipt font-semibold text-success">
                {reportData.totalRevenue > 0 
                  ? ((reportData.totalProfit / reportData.totalRevenue) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Top Selling Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reportData.topProducts.length > 0 ? (
            <div className="space-y-3">
              {reportData.topProducts.map((product, index) => (
                <div key={product.id} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.quantity} units sold</p>
                    </div>
                  </div>
                  <span className="font-receipt font-semibold text-success">
                    ${product.revenue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sales data for this period
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {reportData.sales.length > 0 ? (
            <div className="space-y-2">
              {reportData.sales.slice(-5).reverse().map((sale) => (
                <div key={sale.id} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                  <div>
                    <p className="text-sm font-medium">{sale.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.quantity} × ${sale.unitPrice.toFixed(2)} • {format(sale.date, "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-receipt font-semibold text-success">${sale.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">+${sale.profit.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No transactions in this period</p>
          )}
        </CardContent>
      </Card>

      {/* Export Actions */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Export & Share</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={exportToPDF} variant="outline" className="w-full justify-start">
            <Download className="w-4 h-4 mr-2" />
            Export as PDF
          </Button>
          <Button onClick={emailReport} variant="outline" className="w-full justify-start">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Setup Auto Email Reports
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};