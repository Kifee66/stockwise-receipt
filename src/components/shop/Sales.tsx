import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Camera, Calculator, Search, DollarSign, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { type Product, type PaymentMethod, type Sale as StoredSale, type SaleItem as StoredSaleItem } from "@/types/business";
import { SalesManager } from "@/managers/SalesManager";
import { ProductManager } from "@/managers/ProductManager";

interface SalesProps {
  products: Product[];
  salesManager?: SalesManager;
  productManager?: ProductManager;
  onSaleComplete?: () => void;
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
}

export const Sales = ({ products, salesManager, productManager, onSaleComplete }: SalesProps) => {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [customPrice, setCustomPrice] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [cart, setCart] = useState<SaleItem[]>([]);

  // Filter products based on search term and availability
  const availableProducts = products.filter(product =>
    product.current_stock > 0 &&
    (product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (product.category || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedProductDetails = products.find(p => p.id === selectedProduct);

  const addToCart = () => {
    if (!selectedProduct || !quantity) {
      toast({
        title: "Missing Information",
        description: "Please select a product and enter quantity",
        variant: "destructive"
      });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const qty = parseInt(quantity);
    if (qty > product.current_stock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${product.current_stock} units available`,
        variant: "destructive"
      });
      return;
    }

    const unitPrice = customPrice ? parseFloat(customPrice) : product.selling_price;

    const existingItemIndex = cart.findIndex(item => item.productId === selectedProduct);
    
    if (existingItemIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += qty;
      setCart(updatedCart);
    } else {
      const newItem: SaleItem = {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: unitPrice,
        costPrice: product.cost_price
      };
      setCart([...cart, newItem]);
    }

    // Reset form
    setSelectedProduct("");
    setQuantity("");
    setCustomPrice("");
    
    toast({
      title: "Added to Cart",
      description: `${qty} × ${product.name} added`,
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Add items to cart before completing sale",
        variant: "destructive"
      });
      return;
    }

    if (!salesManager || !productManager) {
      toast({
        title: "System Error",
        description: "Sales system not properly initialized",
        variant: "destructive"
      });
      return;
    }

    try {
      // Record the sale using SalesManager
      const saleItems = cart.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          product: product!,
          quantity: item.quantity,
          price: item.unitPrice
        };
      });

      const result = await salesManager.recordSale({
        items: saleItems,
        payment_method: "cash" as PaymentMethod,
        staff_id: undefined,
        customer: null
      });

      if (result.success) {
        const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const totalProfit = cart.reduce((sum, item) => sum + (item.quantity * (item.unitPrice - item.costPrice)), 0);

        toast({
          title: "Sale Completed",
          description: `Total: KSh ${totalAmount.toFixed(2)} | Profit: KSh ${totalProfit.toFixed(2)}`,
        });

        setCart([]);
        onSaleComplete?.();
      } else {
        toast({
          title: "Sale Failed",
          description: result.error || "Failed to process sale",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Sale error:", error);
      toast({
        title: "Sale Failed",
        description: "An error occurred while processing the sale",
        variant: "destructive"
      });
    }
  };

  // Export current cart or today's sales as a printable PDF via window.print()
  type PrintableRow = { name: string; qty: number; unit: number; total: number; date?: string; saleId?: string };

  const exportAsPdf = async () => {
    try {
      const salesToPrint: PrintableRow[] = [];

      if (cart.length > 0) {
        // populate from current cart
        for (const item of cart) {
          salesToPrint.push({
            name: item.productName,
            qty: item.quantity,
            unit: item.unitPrice,
            total: item.quantity * item.unitPrice,
          });
        }
      } else if (salesManager) {
        // fetch today's sales from IndexedDB via SalesManager
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const res = await salesManager.salesByDateRange(start.toISOString(), end.toISOString());
        if (res.success && res.data) {
          for (const s of res.data as StoredSale[]) {
            for (const it of s.items as StoredSaleItem[]) {
              salesToPrint.push({
                name: it.product_name,
                qty: it.quantity,
                unit: it.unit_price,
                total: it.subtotal,
                date: s.date,
                saleId: s.id,
              });
            }
          }
        }
      }

      // Build printable HTML
      const title = cart.length > 0 ? 'Current Sale Receipt' : `Sales Report - ${new Date().toLocaleDateString()}`;
      const rowsHtml = salesToPrint.map(r => `
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd">${r.name}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${r.qty}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">KSh ${Number(r.unit).toFixed(2)}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">KSh ${Number(r.total).toFixed(2)}</td>
        </tr>
      `).join('');

      const totalAmount = cart.length > 0 ? cartTotal : salesToPrint.reduce((s, r) => s + Number(r.total || 0), 0);

      // Generate PDF directly using jsPDF with styling, stock info and paging
      try {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;
        const usableWidth = pageWidth - margin * 2;
        const lineHeight = 16;
        const colWidths = { name: usableWidth * 0.40, category: usableWidth * 0.18, qty: usableWidth * 0.10, unit: usableWidth * 0.12, stock: usableWidth * 0.10, total: usableWidth * 0.10 };

        let currentPage = 1;
        const footer = (p: number, totalP: number) => {
          doc.setFontSize(9);
          doc.text(`Page ${p} of ${totalP}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
        };

        const header = () => {
          doc.setFontSize(16);
          doc.text('StockWise Receipt', margin, 50);
          doc.setFontSize(10);
          doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 66);
          doc.setDrawColor(200);
          doc.setLineWidth(0.5);
          doc.line(margin, 72, pageWidth - margin, 72);
        };

        // Prepare rows with extra details (category, stock, cost/profit if available)
        const rows = salesToPrint.map(r => {
          const product = products.find(p => p.name === r.name) || null;
          const category = product?.category ?? '';
          const stockRemaining = product?.current_stock ?? undefined;
          const cost = product?.cost_price ?? undefined;
          const profit = (typeof cost === 'number') ? (r.total - (cost * r.qty)) : undefined;
          return { ...r, category, stockRemaining, cost, profit };
        });

        // Pagination planning: estimate rows per page
        const headerHeight = 90;
        const footerHeight = 30;
        const availableHeight = pageHeight - margin - headerHeight - footerHeight;
        const rowsPerPage = Math.floor(availableHeight / lineHeight) - 2;
        const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

        let y = margin + headerHeight;
        header();
        doc.setFontSize(11);
        // Column titles
        let x = margin;
        doc.text('Item', x, y); x += colWidths.name;
        doc.text('Category', x, y); x += colWidths.category;
        doc.text('Qty', x, y); x += colWidths.qty;
        doc.text('Unit', x, y); x += colWidths.unit;
        doc.text('Stock', x, y); x += colWidths.stock;
        doc.text('Total', x, y, { align: 'right' });
        y += lineHeight;

        let rowIndex = 0;
        for (const r of rows) {
          if (rowIndex > 0 && rowIndex % rowsPerPage === 0) {
            // footer for current page
            footer(currentPage, totalPages);
            doc.addPage();
            currentPage += 1;
            header();
            y = margin + headerHeight + lineHeight;
            // reprint headers
            x = margin;
            doc.setFontSize(11);
            doc.text('Item', x, y - lineHeight); x += colWidths.name;
            doc.text('Category', x, y - lineHeight); x += colWidths.category;
            doc.text('Qty', x, y - lineHeight); x += colWidths.qty;
            doc.text('Unit', x, y - lineHeight); x += colWidths.unit;
            doc.text('Stock', x, y - lineHeight); x += colWidths.stock;
            doc.text('Total', x, y - lineHeight, { align: 'right' });
          }

          x = margin;
          doc.setFontSize(10);
          doc.text(String(r.name).slice(0, 40), x, y); x += colWidths.name;
          doc.text(String(r.category || '').slice(0, 20), x, y); x += colWidths.category;
          doc.text(String(r.qty), x, y); x += colWidths.qty;
          doc.text(`KSh ${Number(r.unit).toFixed(2)}`, x, y, { align: 'right' }); x += colWidths.unit;
          doc.text(r.stockRemaining !== undefined ? String(r.stockRemaining) : '-', x, y, { align: 'right' }); x += colWidths.stock;
          doc.text(`KSh ${Number(r.total).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
          y += lineHeight;
          rowIndex += 1;
        }

        // Grand total on last page
        if (y + 24 > pageHeight - footerHeight) { doc.addPage(); currentPage += 1; y = margin + headerHeight; }
        doc.setFontSize(12);
        doc.text(`Grand Total: KSh ${Number(totalAmount).toFixed(2)}`, margin, y + 12);
        // footer
        footer(currentPage, totalPages);

        const filename = cart.length > 0 ? `receipt_${Date.now()}.pdf` : `sales_${new Date().toISOString().slice(0,10)}.pdf`;
        doc.save(filename);
        return;
      } catch (pdfError) {
        console.warn('jsPDF generation failed, falling back to print window', pdfError);
        // fallback to previous print approach
        const html = `
          <html>
            <head>
              <title>${title}</title>
              <style>
                body { font-family: Arial, Helvetica, sans-serif; padding: 16px; color: #111 }
                table { width:100%; border-collapse: collapse; margin-top: 12px }
                th { text-align:left; padding:6px 8px; border-bottom:2px solid #222 }
              </style>
            </head>
            <body>
              <h2>${title}</h2>
              <div>Generated: ${new Date().toLocaleString()}</div>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style="text-align:right">Qty</th>
                    <th style="text-align:right">Unit</th>
                    <th style="text-align:right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="4" style="padding:8px;text-align:center">No items to print</td></tr>'}
                </tbody>
              </table>
              <div style="margin-top:12px;font-weight:600">Grand Total: KSh ${Number(totalAmount).toFixed(2)}</div>
            </body>
          </html>
        `;
        const w = window.open('', '_blank', 'noopener,noreferrer');
        if (!w) {
          toast({ title: 'Popup blocked', description: 'Please allow popups to export as PDF', variant: 'destructive' });
          return;
        }
        w.document.write(html);
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 300);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Export error', e);
      toast({ title: 'Export Failed', description: msg || 'Failed to export PDF', variant: 'destructive' });
    }
  };

  const exportAsCsv = async () => {
    try {
      const rows: Array<Record<string, string | number | undefined>> = [];
      if (cart.length > 0) {
        for (const item of cart) {
          const product = products.find(p => p.id === item.productId);
          rows.push({
            id: item.productId,
            name: item.productName,
            category: product?.category ?? '',
            qty: item.quantity,
            unit_price: item.unitPrice.toFixed(2),
            cost_price: product?.cost_price ?? '',
            stock_remaining: product?.current_stock ?? '',
            total: (item.quantity * item.unitPrice).toFixed(2),
            profit: product ? ((item.unitPrice - (product.cost_price)) * item.quantity).toFixed(2) : '',
          });
        }
      } else if (salesManager) {
        const start = new Date();
        start.setHours(0,0,0,0);
        const end = new Date();
        end.setHours(23,59,59,999);
        const res = await salesManager.salesByDateRange(start.toISOString(), end.toISOString());
        if (res.success && res.data) {
          for (const s of res.data as StoredSale[]) {
            for (const it of s.items as StoredSaleItem[]) {
              const product = products.find(p => p.id === it.product_id);
              rows.push({
                id: it.product_id,
                name: it.product_name,
                category: product?.category ?? '',
                qty: it.quantity,
                unit_price: it.unit_price.toFixed(2),
                cost_price: product?.cost_price ?? '',
                stock_remaining: product?.current_stock ?? '',
                total: it.subtotal.toFixed(2),
                profit: product ? ((it.unit_price - product.cost_price) * it.quantity).toFixed(2) : '',
                sale_date: s.date,
                sale_id: s.id,
              });
            }
          }
        }
      }

      if (rows.length === 0) {
        toast({ title: 'No data', description: 'Nothing to export' });
        return;
      }

      const headers = Object.keys(rows[0]);
      const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => String(r[h] ?? '')).join(','))).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cart.length > 0 ? `receipt_${Date.now()}.csv` : `sales_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed', err);
      toast({ title: 'Export Failed', description: 'Failed to export CSV' });
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const cartProfit = cart.reduce((sum, item) => 
    sum + (item.quantity * (item.unitPrice - item.costPrice)), 0
  );

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card className="shadow-receipt">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search products to sell..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Add to Cart Form */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            Add Sale Item
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    <div className="flex justify-between w-full">
                      <span>{product.name}</span>
                      <div className="flex gap-1 ml-2">
                        <Badge variant="outline" className="font-receipt text-xs">
                          {product.current_stock} left
                        </Badge>
                        <Badge variant="secondary" className="font-receipt text-xs">
                          KSh {product.selling_price}
                        </Badge>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-receipt"
                max={selectedProductDetails?.current_stock || 0}
              />
              {selectedProductDetails && quantity && (
                <p className="text-xs text-muted-foreground">
                  {selectedProductDetails.current_stock} available
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Custom Price (Optional)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder={selectedProductDetails?.selling_price.toFixed(2) || "0.00"}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="font-receipt"
              />
            </div>
          </div>

          {selectedProductDetails && quantity && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-receipt">
                    KSh {((parseFloat(quantity) || 0) * 
                        (customPrice ? parseFloat(customPrice) : selectedProductDetails.selling_price)
                      ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-success">
                  <span>Profit:</span>
                  <span className="font-receipt">
                    KSh {((parseFloat(quantity) || 0) * 
                        ((customPrice ? parseFloat(customPrice) : selectedProductDetails.selling_price) - 
                         selectedProductDetails.cost_price)
                      ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Button onClick={addToCart} className="w-full">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Add to Cart
          </Button>
        </CardContent>
      </Card>

      {/* Shopping Cart */}
      {cart.length > 0 && (
        <Card className="shadow-receipt">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-success" />
              Current Sale ({cart.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.productId} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × KSh {item.unitPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-receipt font-semibold">
                      KSh {(item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFromCart(item.productId)}
                      className="text-xs h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span className="font-receipt text-lg">KSh {cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-success">
                <span>Expected Profit:</span>
                <span className="font-receipt">KSh {cartProfit.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={completeSale} className="flex-1">
                <DollarSign className="w-4 h-4 mr-2" />
                Complete Sale
              </Button>
              <Button onClick={exportAsPdf} variant="outline" className="flex-none">
                <Printer className="w-4 h-4 mr-2" />
                Export as PDF
              </Button>
              <Button onClick={exportAsCsv} variant="outline" className="flex-none">
                CSV
              </Button>
              <Button variant="outline" size="icon">
                <Camera className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Sale Items */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3 flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Available Products</CardTitle>
          <Button onClick={exportAsPdf} variant="ghost" size="sm" className="ml-2">
            <Printer className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {availableProducts.length > 0 ? (
            <div className="space-y-2">
              {availableProducts.slice(0, 5).map((product) => (
                <div key={product.id} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-receipt text-xs">
                      {product.current_stock} left
                    </Badge>
                    <Badge className="font-receipt text-xs">
                      KSh {product.selling_price}
                    </Badge>
                  </div>
                </div>
              ))}
              {availableProducts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Use search to find more products
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No products available for sale
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};