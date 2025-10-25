import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Camera, FileText, Search, Check, ChevronsUpDown, X, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductForm } from "./ProductForm";
import { ProductManager } from "@/managers/ProductManager";
import { StockManager } from "@/managers/StockManager";
import { type Product } from "@/types/business";

interface RestockingProps {
  products: Product[];
  productManager: ProductManager;
  stockManager: StockManager;
  onProductsChange: () => void;
}

export const Restocking = ({ products, productManager, stockManager, onProductsChange }: RestockingProps) => {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [costPrice, setCostPrice] = useState<string>("");
  const [sellingPrice, setSellingPrice] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [showPricingUpdate, setShowPricingUpdate] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load categories when products change
  useEffect(() => {
    const getCategories = async () => {
      const result = await productManager.listCategories();
      if (result.success) {
        setCategories(result.data);
      }
    };
    getCategories();
  }, [products, productManager]);

  const handleRestock = async () => {
    if (!selectedProduct || !quantity) {
      toast({
        title: "Missing Information",
        description: "Please select a product and enter quantity",
        variant: "destructive"
      });
      return;
    }

    // Validate pricing if pricing update is enabled
    if (showPricingUpdate && (!costPrice || !sellingPrice)) {
      toast({
        title: "Missing Pricing",
        description: "Please enter both cost price and selling price",
        variant: "destructive"
      });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    try {
      const quantityNum = parseInt(quantity);

      // Update product prices if pricing update is enabled
      if (showPricingUpdate && costPrice && sellingPrice) {
        const costNum = parseFloat(costPrice);
        const sellingNum = parseFloat(sellingPrice);

        const priceUpdateResult = await productManager.editProduct(selectedProduct, {
          cost_price: costNum,
          selling_price: sellingNum,
        });

        if (!priceUpdateResult.success) {
          throw new Error(priceUpdateResult.error || "Failed to update prices");
        }
      }

      // Update stock
      const stockResult = await productManager.updateStock(selectedProduct, quantityNum);
      if (!stockResult.success) {
        throw new Error(stockResult.error);
      }

      // Record stock movement
      const movementResult = await stockManager.logMovement({
        product_id: selectedProduct,
        quantity: quantityNum,
        type: "restock",
        notes: notes || null,
      });

      if (!movementResult.success) {
        console.warn("Failed to record stock movement:", movementResult.error);
      }

      const successMsg = showPricingUpdate
        ? `Added ${quantity} units of ${product.name} and updated pricing`
        : `Added ${quantity} units of ${product.name}`;

      toast({
        title: "Stock Updated",
        description: successMsg,
      });

      onProductsChange();

      // Reset form
      setSelectedProduct("");
      setQuantity("");
      setCostPrice("");
      setSellingPrice("");
      setNotes("");
      setShowPricingUpdate(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast({
        title: "Error",
        description: msg || "Failed to update stock",
        variant: "destructive",
      });
    }
  };

  const handleProductAdded = () => {
    onProductsChange();
    setShowNewProduct(false);
  };

  const calculateMargin = () => {
    const cost = parseFloat(costPrice);
    const selling = parseFloat(sellingPrice);
    if (cost && selling && cost > 0) {
      return (((selling - cost) / cost) * 100).toFixed(1);
    }
    return "0";
  };

  const exportInventoryAsCsv = () => {
    try {
      if (products.length === 0) {
        toast({
          title: "No Products",
          description: "No inventory to export",
          variant: "destructive"
        });
        return;
      }

      // CSV header
      const headers = ["name", "category", "cost_price", "selling_price", "current_stock", "low_stock_threshold"];

      // CSV rows
      const rows = products.map(p => [
        p.name,
        p.category || "",
        p.cost_price,
        p.selling_price,
        p.current_stock,
        p.low_stock_threshold || 5
      ]);

      // Build CSV
      const csv = [headers.join(",")]
        .concat(rows.map(r => r.join(",")))
        .join("\n");

      // Download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${products.length} products`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export inventory",
        variant: "destructive"
      });
    }
  };

  const importInventoryFromCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error("CSV file is empty or invalid");
      }

      // Parse header
      const header = lines[0].split(",").map(h => h.trim());
      const requiredFields = ["name", "cost_price", "selling_price", "current_stock"];
      const missingFields = requiredFields.filter(f => !header.includes(f));

      if (missingFields.length > 0) {
        throw new Error(`Missing required columns: ${missingFields.join(", ")}`);
      }

      // Parse rows
      const importData: Array<{
        name: string;
        category?: string | null;
        cost_price?: number;
        selling_price?: number;
        current_stock?: number;
        low_stock_threshold?: number;
      }> = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        if (values.length === 0 || values.every(v => !v)) continue; // Skip empty rows

        const row: Record<string, string> = {};
        header.forEach((h, idx) => {
          row[h] = values[idx] || "";
        });

        importData.push({
          name: row.name,
          category: row.category || null,
          cost_price: parseFloat(row.cost_price) || 0,
          selling_price: parseFloat(row.selling_price) || 0,
          current_stock: parseInt(row.current_stock) || 0,
          low_stock_threshold: parseInt(row.low_stock_threshold) || 5,
        });
      }

      if (importData.length === 0) {
        throw new Error("No valid products found in CSV");
      }

      // Import using ProductManager
      const result = await productManager.importProducts(importData);

      if (result.success) {
        toast({
          title: "Import Successful",
          description: `Imported ${importData.length} products`,
        });
        onProductsChange();
      } else {
        throw new Error(result.error || "Import failed");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast({
        title: "Import Failed",
        description: msg,
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Restock Form */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Add Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Product Selection with Combobox */}
          <div className="space-y-2">
            <Label>Product *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between font-normal"
                >
                  {selectedProduct
                    ? products.find((product) => product.id === selectedProduct)?.name
                    : "Select or search product..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search products..." />
                  <CommandEmpty>No product found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {products.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.name}
                        onSelect={() => {
                          setSelectedProduct(product.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProduct === product.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex items-center justify-between flex-1">
                          <span>{product.name}</span>
                          <Badge variant="outline" className="ml-2 font-receipt text-xs">
                            {product.current_stock} in stock
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="font-receipt"
            />
          </div>

          {/* Update Pricing - Collapsible */}
          {!showPricingUpdate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPricingUpdate(true)}
              className="w-full justify-start text-muted-foreground hover:text-foreground -mt-1"
            >
              <Plus className="w-3 h-3 mr-1" />
              Update Pricing (optional)
            </Button>
          ) : (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Update Pricing</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPricingUpdate(false);
                    setCostPrice("");
                    setSellingPrice("");
                  }}
                  className="h-6 px-2 text-xs"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="newCost" className="text-xs">New Cost Price (KSh)</Label>
                  <Input
                    id="newCost"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="newSelling" className="text-xs">New Selling Price (KSh)</Label>
                  <Input
                    id="newSelling"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              {parseFloat(costPrice) > 0 && parseFloat(sellingPrice) > 0 && (
                <div className="bg-muted/50 p-2 rounded-lg">
                  <div className="flex justify-between text-xs">
                    <span>Profit Margin:</span>
                    <Badge variant={parseFloat(calculateMargin()) > 0 ? "default" : "destructive"} className="text-xs">
                      {calculateMargin()}%
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this restock..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none h-16"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleRestock} className="flex-1">
              <Package className="w-4 h-4 mr-2" />
              Add Stock
            </Button>
            <Button variant="outline" size="icon">
              <Camera className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            onClick={() => setShowNewProduct(!showNewProduct)}
            className="w-full justify-start"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Product
          </Button>

          <Button
            variant="outline"
            onClick={exportInventoryAsCsv}
            className="w-full justify-start"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Inventory
          </Button>

          <div>
            <input
              type="file"
              accept=".csv"
              onChange={importInventoryFromCsv}
              style={{ display: "none" }}
              id="inventory-import"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById("inventory-import")?.click()}
              disabled={isImporting}
              className="w-full justify-start"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isImporting ? "Importing..." : "Import Inventory"}
            </Button>
          </div>

          {showNewProduct && (
            <ProductForm
              onClose={() => setShowNewProduct(false)}
              onProductAdded={handleProductAdded}
              productManager={productManager}
              existingCategories={categories}
            />
          )}
        </CardContent>
      </Card>

      {/* Low Stock Items */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-warning">Items Needing Restock</CardTitle>
        </CardHeader>
        <CardContent>
          {products.filter(p => p.current_stock <= (p.low_stock_threshold || 0)).length > 0 ? (
            <div className="space-y-2">
              {products
                .filter(p => p.current_stock <= (p.low_stock_threshold || 0))
                .map((product) => (
                  <div key={product.id} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category || "Uncategorized"}</p>
                    </div>
                    <Badge variant="destructive" className="font-receipt">
                      {product.current_stock} left
                    </Badge>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              All items are well stocked! 🎉
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};