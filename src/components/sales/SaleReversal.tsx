import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SalesManager } from "@/managers/SalesManager";
import { type Sale } from "@/types/business";
import { formatCurrency } from "@/utils/currency";

interface SaleReversalProps {
  sale: Sale;
  salesManager: SalesManager;
  onReversed?: (sale: Sale) => void;
  currentStaffId?: string;
}

export const SaleReversal: React.FC<SaleReversalProps> = ({ 
  sale, 
  salesManager, 
  onReversed,
  currentStaffId 
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [canReverse, setCanReverse] = useState<boolean | null>(null);

  React.useEffect(() => {
    if (sale.status === "reversed") {
      setCanReverse(false);
      return;
    }
    
    salesManager.canReverseSale(sale.id).then(setCanReverse);
  }, [sale, salesManager]);

  const handleReverse = async () => {
    setLoading(true);
    try {
      const result = await salesManager.reverseSale(sale.id, reason || undefined, currentStaffId);
      
      if (result.success) {
        toast({
          title: "Sale Reversed",
          description: `Sale ${sale.receipt?.number || sale.id} has been reversed successfully.`,
        });
        onReversed?.(result.data);
        setOpen(false);
        setReason("");
      } else {
        toast({
          title: "Reversal Failed",
          description: "error" in result ? result.error : "Failed to reverse sale",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Reversal Failed",
        description: error instanceof Error ? error.message : "Failed to reverse sale",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sale.status === "reversed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <RotateCcw className="w-3 h-3" />
        Reversed
      </Badge>
    );
  }

  if (canReverse === false) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <AlertTriangle className="w-3 h-3" />
        Cannot Reverse
      </Badge>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1"
          disabled={canReverse === null}
        >
          <RotateCcw className="w-3 h-3" />
          Reverse
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse Sale</DialogTitle>
          <DialogDescription>
            This will reverse the sale and restore the items back to inventory. 
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sale Summary */}
          <div className="p-4 border rounded-lg bg-muted/20">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receipt:</span>
                <span className="font-mono">{sale.receipt?.number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-semibold">{formatCurrency(sale.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items:</span>
                <span>{sale.items.length} item(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{new Date(sale.date).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Items to be restored */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Items to restore to inventory:</Label>
            <div className="p-3 border rounded-lg bg-background">
              {sale.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm py-1">
                  <span>{item.product_name}</span>
                  <span className="font-mono">+{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for reversal (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for reversing this sale..."
              rows={3}
            />
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              This will permanently reverse the sale and restore all items to inventory. 
              The sale will be marked as reversed and this action cannot be undone.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleReverse} 
            disabled={loading}
            variant="destructive"
          >
            {loading ? "Reversing..." : "Reverse Sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};