"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

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

interface AdjustmentDetailClientProps {
  adjustment: Adjustment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdjustmentDetailClient({
  adjustment,
  open,
  onOpenChange,
}: AdjustmentDetailClientProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adjustment Detail</DialogTitle>
          <DialogDescription>{adjustment.referenceNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
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
              <Badge variant="secondary" className="mt-0.5 text-[10px]">
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
              <p className="text-sm">{formatDate(adjustment.createdAt)}</p>
            </div>
            {adjustment.postedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Posted At</p>
                <p className="text-sm">{formatDate(adjustment.postedAt)}</p>
              </div>
            )}
            {adjustment.notes && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="rounded-md bg-muted p-2 text-sm">{adjustment.notes}</p>
              </div>
            )}
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-sm font-semibold">Items</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
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
                      <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {Number(item.unitCost) > 0 ? formatCurrency(item.unitCost) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(item.unitCost) > 0
                          ? formatCurrency(Number(item.unitCost) * item.quantity)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
