import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, X } from "lucide-react";
import { ProductManager, type NewProduct } from "@/managers/ProductManager";

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional(),
  category: z.string().optional(),
  cost_price: z.number().min(0, "Cost price must be positive"),
  selling_price: z.number().min(0, "Selling price must be positive"),
  current_stock: z.number().int().min(0, "Current stock must be non-negative"),
  low_stock_threshold: z.number().int().min(0, "Low stock threshold must be non-negative"),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  onClose: () => void;
  onProductAdded: () => void;
  productManager: ProductManager;
  existingCategories: string[];
}

export const ProductForm = ({ onClose, onProductAdded, productManager, existingCategories }: ProductFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      category: "",
      cost_price: 0,
      selling_price: 0,
      current_stock: 0,
      low_stock_threshold: 5,
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    
    try {
      const productData: NewProduct = {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || null,
        category: showCustomCategory ? customCategory : data.category || null,
        cost_price: data.cost_price,
        selling_price: data.selling_price,
        current_stock: data.current_stock,
        low_stock_threshold: data.low_stock_threshold,
      };

      const result = await productManager.addProduct(productData);
      
      if (result.success) {
        toast({
          title: "Product Added",
          description: `${data.name} has been added to inventory`,
        });
        onProductAdded();
        onClose();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add product",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateMargin = () => {
    const cost = form.watch("cost_price");
    const selling = form.watch("selling_price");
    if (cost && selling && cost > 0) {
      return (((selling - cost) / cost) * 100).toFixed(1);
    }
    return "0";
  };

  return (
    <Card className="shadow-receipt">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Add New Product
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information */}
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter SKU (e.g., ABC-001)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter barcode (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              {!showCustomCategory ? (
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {existingCategories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomCategory(true)}
                    className="w-full"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add New Category
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter new category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCustomCategory(false);
                      setCustomCategory("");
                    }}
                    className="w-full"
                  >
                    Use Existing Category
                  </Button>
                </div>
              )}
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="cost_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price (KSh) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="selling_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price (KSh) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Profit Margin Display */}
            {form.watch("cost_price") > 0 && form.watch("selling_price") > 0 && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Profit Margin:</span>
                  <Badge variant={parseFloat(calculateMargin()) > 0 ? "default" : "destructive"}>
                    {calculateMargin()}%
                  </Badge>
                </div>
              </div>
            )}

            {/* Stock Information */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="current_stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Stock *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="low_stock_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Stock Alert *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="5"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Package className="w-4 h-4 mr-2 animate-pulse" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};