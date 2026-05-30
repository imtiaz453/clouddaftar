"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, MoreHorizontal, Eye, ArrowUpDown, Truck, CheckCircle, XCircle, Loader2, AlertCircle, Package, ClipboardList, FileText, TrendingUp, AlertTriangle, Calendar, Clock, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { postStockAdjustmentAction } from "@/actions/inventory";
import { toast } from "sonner";

interface AdjustmentItem {
  id: string;
  product: { name: string; sku: string | null };
  direction: string;
  quantity: number;
  unitCost: number;
}

interface Adjustment {
  id: string;
  referenceNumber: string;
  location: { id: string; name: string };
  reason: string;
  notes: string | null;
  postedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  items: AdjustmentItem[];
}

const reasonLabels: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  CORRECTION: "Correction",
  DAMAGE: "Damage",
  EXPIRED: "Expired",
  LOST: "Lost",
  FOUND: "Found",
  INTERNAL_USE: "Internal Use",
};

const reasonVariants: Record<string, "default" | "secondary" | "destructive" | "warning" | "success" | "outline"> = {
  OPENING_BALANCE: "default",
  CORRECTION: "secondary",
  DAMAGE: "destructive",
  EXPIRED: "warning",
  LOST: "outline",
  FOUND: "success",
  INTERNAL_USE: "warning",
};

interface AdjustmentDetailClientProps {
  adjustment: Adjustment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPosted?: () => void;
}

export function AdjustmentDetailClient({
  adjustment,
  open,
  onOpenChange,
  onPosted,
}: AdjustmentDetailClientProps) {
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    setPosting(true);
    try {
      await postStockAdjustmentAction(adjustment.id);
      toast.success("Adjustment posted successfully");
      onPosted?.();
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to post adjustment", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPosting(false);
    }
  }

  const totalCost = adjustment.items.reduce(
    (s, i) => s + (Number(i.unitCost) > 0 ? Number(i.unitCost) * Number(i.quantity) : 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjustment Detail</DialogTitle>
          <DialogDescription>{adjustment.referenceNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="font-mono text-sm font-medium">{adjustment.referenceNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-medium">{adjustment.location.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reason</p>
              <Badge variant={reasonVariants[adjustment.reason] || "secondary"} className="mt-0.5 text-[10px]">
                {reasonLabels[adjustment.reason] || adjustment.reason}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              {adjustment.postedAt ? (
                <Badge variant="success" className="mt-0.5">Posted</Badge>
              ) : (
                <Badge variant="secondary" className="mt-0.5">Draft</Badge>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="text-sm">{adjustment.createdBy.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created At</p>
              <p className="text-sm">{formatDateTime(adjustment.createdAt)}</p>
            </div>
            {adjustment.postedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Posted At</p>
                <p className="text-sm">{formatDateTime(adjustment.postedAt)}</p>
              </div>
            )}
          </div>

          {adjustment.notes && (
            <>
              <Separator />
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Notes</p>
                <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{adjustment.notes}</p>
              </div>
            </>
          )}

          <Separator />
          <div>
            <p className="mb-3 text-sm font-semibold">
              Items ({adjustment.items.length})
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustment.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                      No items
                    </TableCell>
                  </TableRow>
                ) : (
                  adjustment.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{item.product.name}</p>
                        {item.product.sku && (
                          <p className="font-mono text-xs text-muted-foreground">{item.product.sku}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.direction === "IN" ? (
                          <Badge variant="success" className="text-[10px]">+ IN</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">- OUT</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {Number(item.quantity)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {Number(item.unitCost) > 0 ? formatCurrency(item.unitCost) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {Number(item.unitCost) > 0
                          ? formatCurrency(Number(item.unitCost) * Number(item.quantity))
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="mt-2 flex justify-end text-sm font-semibold">
              Total: {formatCurrency(totalCost)}
            </div>
          </div>

          {!adjustment.postedAt && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handlePost} disabled={posting}>
                {posting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Post Adjustment
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
