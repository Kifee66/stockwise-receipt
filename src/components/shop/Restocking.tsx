import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Camera, FileText, Search } from "lucide-react";
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
  const [notes, setNotes] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

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

  // Filter products based on search term
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRestock = async () => {
    if (!selectedProduct || !quantity || !costPrice) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    try {
      const quantityNum = parseInt(quantity);
      const costNum = parseFloat(costPrice);
      
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

      toast({
        title: "Stock Updated",
        description: `Added ${quantity} units of ${product.name}`,
      });

      onProductsChange();
      
      // Reset form
      setSelectedProduct("");
      setQuantity("");
      setCostPrice("");
      setNotes("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update stock",
        variant: "destructive",
      });
    }
  };

  const handleProductAdded = () => {
    onProductsChange();
    setShowNewProduct(false);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card className="shadow-receipt">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Restock Form */}
      <Card className="shadow-receipt">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Add Stock
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
                {filteredProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    <div className="flex justify-between w-full">
                      <span>{product.name}</span>
                      <Badge variant="outline" className="ml-2 font-receipt">
                        {product.current_stock} in stock
                      </Badge>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost per Unit</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="font-receipt"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this restock..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none h-20"
            />
          </div>

          {/* Calculate total */}
          {quantity && costPrice && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Total Cost:</span>
                <span className="font-receipt font-semibold">
                  KSh {(parseFloat(quantity) * parseFloat(costPrice)).toFixed(2)}
                </span>
              </div>
            </div>
          )}

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

          <Button variant="outline" className="w-full justify-start">
            <FileText className="w-4 h-4 mr-2" />
            Scan Receipt (Coming Soon)
          </Button>

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