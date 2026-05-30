"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Building2,
  MapPin,
  User,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowUpDown,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TableSkeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { formatDateTime, cn } from "@/lib/utils";
import {
  issueStockTransferAction,
  receiveStockTransferAction,
  cancelStockTransferAction,
} from "@/actions/inventory";

const STATUS_BADGE: Record<string, "warning" | "default" | "success" | "destructive"> = {
  DRAFT: "warning",
  ISSUED: "default",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "destructive",
};

interface Location {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface TransferItem {
  id: string;
  quantity: number;
  product: { id: string; name: string; sku: string | null; unit: string };
}

interface LedgerEntry {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  locationName: string;
  movementType: string;
  quantity: number;
  qtyOnHandBefore: number;
  qtyOnHandAfter: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface Transfer {
  id: string;
  referenceNumber: string;
  status: string;
  sourceLocation: Location;
  destinationLocation: Location;
  createdBy: { id: string; name: string | null; email: string };
  notes: string | null;
  createdAt: string;
  issuedAt: string | null;
  receivedAt: string | null;
  items: TransferItem[];
}

interface TransferDetailClientProps {
  transfer: Transfer;
}

export function TransferDetailClient({ transfer }: TransferDetailClientProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "issue" | "receive" | "cancel";
  } | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);

  const status = transfer.status;

  useEffect(() => {
    if (status === "ISSUED" || status === "PARTIALLY_RECEIVED" || status === "RECEIVED") {
      fetchLedger();
    } else {
      setLedgerLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function fetchLedger() {
    setLedgerLoading(true);
    try {
      const res = await fetch(
        `/api/inventory/ledger?reference=${encodeURIComponent(transfer.referenceNumber)}&pageSize=100`,
      );
      const json = await res.json();
      if (json.success) {
        setLedgerEntries(json.data?.data ?? json.data ?? []);
      }
    } catch {
      setLedgerEntries([]);
    } finally {
      setLedgerLoading(false);
    }
  }

  async function handleIssue() {
    setActionLoading("issue");
    try {
      await issueStockTransferAction(transfer.id);
      toast.success("Transfer issued successfully");
      setConfirmAction(null);
      router.refresh();
    } catch (err) {
      toast.error("Failed to issue transfer", { description: String(err) });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReceive() {
    setActionLoading("receive");
    try {
      await receiveStockTransferAction(transfer.id);
      toast.success("Transfer received successfully");
      setConfirmAction(null);
      router.refresh();
    } catch (err) {
      toast.error("Failed to receive transfer", { description: String(err) });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    setActionLoading("cancel");
    try {
      await cancelStockTransferAction(transfer.id);
      toast.success("Transfer cancelled");
      setConfirmAction(null);
      router.refresh();
    } catch (err) {
      toast.error("Failed to cancel transfer", { description: String(err) });
    } finally {
      setActionLoading(null);
    }
  }

  const confirmConfig = {
    issue: {
      title: "Issue Transfer",
      description: `Issue "${transfer.referenceNumber}"? Stock will be reserved at source location.`,
      confirmText: "Issue",
      action: handleIssue,
    },
    receive: {
      title: "Receive Transfer",
      description: `Receive "${transfer.referenceNumber}"? Stock will be moved to ${transfer.destinationLocation.name}.`,
      confirmText: "Receive",
      action: handleReceive,
    },
    cancel: {
      title: "Cancel Transfer",
      description: `Cancel "${transfer.referenceNumber}"? This cannot be undone.`,
      confirmText: "Cancel",
      action: handleCancel,
    },
  };

  const totalQty = transfer.items.reduce((sum, i) => sum + Number(i.quantity), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={transfer.referenceNumber}
        description="Stock transfer detail"
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-muted-foreground" />
                Transfer Items
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {transfer.items.length} item{transfer.items.length !== 1 ? "s" : ""} · {totalQty} total
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfer.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.product.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.product.sku || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {Number(item.quantity)} {item.product.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {(status === "ISSUED" || status === "PARTIALLY_RECEIVED" || status === "RECEIVED") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
                  Ledger Movements
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ledgerLoading ? (
                  <div className="p-4">
                    <TableSkeleton rows={3} />
                  </div>
                ) : ledgerEntries.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-sm text-muted-foreground">
                    <Truck className="mb-2 h-8 w-8 opacity-40" />
                    <p>No ledger entries found for this transfer</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Before</TableHead>
                        <TableHead className="text-right">After</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">
                            {entry.productName}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.locationName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {entry.movementType}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium tabular-nums",
                              entry.quantity > 0
                                ? "text-emerald-600"
                                : "text-red-600",
                            )}
                          >
                            {entry.quantity > 0
                              ? `+${entry.quantity}`
                              : entry.quantity}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                            {entry.qtyOnHandBefore}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                            {entry.qtyOnHandAfter}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(entry.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {transfer.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {transfer.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                <Badge
                  variant={STATUS_BADGE[status] || "default"}
                  className="mt-1"
                >
                  {status.replace(/_/g, " ")}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Source Location
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    {transfer.sourceLocation.name}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {transfer.sourceLocation.code}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Destination Location
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    {transfer.destinationLocation.name}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {transfer.destinationLocation.code}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{transfer.createdBy.name || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Created: {formatDateTime(transfer.createdAt)}</span>
                </div>
                {transfer.issuedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Issued: {formatDateTime(transfer.issuedAt)}</span>
                  </div>
                )}
                {transfer.receivedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Received: {formatDateTime(transfer.receivedAt)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {status === "DRAFT" && (
                <Button
                  className="w-full"
                  onClick={() => setConfirmAction({ type: "issue" })}
                >
                  <CheckCircle className="mr-2 h-4 w-4" /> Issue Transfer
                </Button>
              )}
              {(status === "ISSUED" || status === "PARTIALLY_RECEIVED") && (
                <Button
                  className="w-full"
                  onClick={() => setConfirmAction({ type: "receive" })}
                >
                  <Package className="mr-2 h-4 w-4" /> Receive Transfer
                </Button>
              )}
              {(status === "DRAFT" || status === "ISSUED") && (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirmAction({ type: "cancel" })}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Cancel Transfer
                </Button>
              )}
              {(status === "RECEIVED" || status === "CANCELLED") && (
                <p className="text-center text-xs text-muted-foreground">
                  No actions available for {status.toLowerCase()} transfers
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={() => setConfirmAction(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmAction ? confirmConfig[confirmAction.type].title : ""}
            </DialogTitle>
            <DialogDescription>
              {confirmAction ? confirmConfig[confirmAction.type].description : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={
                confirmAction?.type === "cancel" ? "destructive" : "default"
              }
              onClick={() => {
                if (confirmAction) confirmConfig[confirmAction.type].action();
              }}
              disabled={actionLoading !== null}
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {confirmAction ? confirmConfig[confirmAction.type].confirmText : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
