import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Camera, Calculator, Search, DollarSign } from "lucide-react";

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

interface SalesProps {
  products: Product[];
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
}

export const Sales = ({ products }: SalesProps) => {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [customPrice, setCustomPrice] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [cart, setCart] = useState<SaleItem[]>([]);

  // Filter products based on search term and availability
  const availableProducts = products.filter(product =>
    product.currentStock > 0 &&
    (product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     product.category.toLowerCase().includes(searchTerm.toLowerCase()))
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
    if (qty > product.currentStock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${product.currentStock} units available`,
        variant: "destructive"
      });
      return;
    }

    const unitPrice = customPrice ? parseFloat(customPrice) : product.sellingPrice;

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
        costPrice: product.costPrice
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

  const completeSale = () => {
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Add items to cart before completing sale",
        variant: "destructive"
      });
      return;
    }

    const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const totalCost = cart.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
    const totalProfit = totalAmount - totalCost;

    // Here you would normally update the database and reduce stock
    toast({
      title: "Sale Completed",
      description: `Total: $${totalAmount.toFixed(2)} | Profit: $${totalProfit.toFixed(2)}`,
    });

    setCart([]);
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
                          {product.currentStock} left
                        </Badge>
                        <Badge variant="secondary" className="font-receipt text-xs">
                          ${product.sellingPrice}
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
                max={selectedProductDetails?.currentStock || 0}
              />
              {selectedProductDetails && quantity && (
                <p className="text-xs text-muted-foreground">
                  {selectedProductDetails.currentStock} available
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Custom Price (Optional)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder={selectedProductDetails?.sellingPrice.toFixed(2) || "0.00"}
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
                    ${((parseFloat(quantity) || 0) * 
                        (customPrice ? parseFloat(customPrice) : selectedProductDetails.sellingPrice)
                      ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-success">
                  <span>Profit:</span>
                  <span className="font-receipt">
                    ${((parseFloat(quantity) || 0) * 
                        ((customPrice ? parseFloat(customPrice) : selectedProductDetails.sellingPrice) - 
                         selectedProductDetails.costPrice)
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
                      {item.quantity} × ${item.unitPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-receipt font-semibold">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
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
                <span className="font-receipt text-lg">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-success">
                <span>Expected Profit:</span>
                <span className="font-receipt">${cartProfit.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={completeSale} className="flex-1">
                <DollarSign className="w-4 h-4 mr-2" />
                Complete Sale
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
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Available Products</CardTitle>
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
                      {product.currentStock} left
                    </Badge>
                    <Badge className="font-receipt text-xs">
                      ${product.sellingPrice}
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