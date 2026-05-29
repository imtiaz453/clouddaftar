"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Calendar, User, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import {
  receiveStockTransferAction,
  cancelStockTransferAction,
} from "@/actions/inventory-new";

interface Location {
  id: string;
  name: string;
  code: string;
  type: string;
  [key: string]: unknown;
}

interface TransferItem {
  id: string;
  quantity: number;
  product: { id: string; name: string; sku: string | null; unit: string; };
}

interface Transfer {
  id: string;
  referenceNumber: string;
  status: string;
  sourceLocation: Location;
  destinationLocation: Location;
  createdBy: { id: string; name: string | null; email: string; };
  notes: string | null;
  createdAt: string;
  issuedAt: string | null;
  receivedAt: string | null;
  items: TransferItem[];
}

interface TransferDetailClientProps {
  transfer: Transfer;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  IN_TRANSIT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function TransferDetailClient({ transfer }: TransferDetailClientProps) {
  const router = useRouter();
  const { addToast } = useToast();

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const status = transfer.status;
  const canReceive = status === "PENDING" || status === "IN_TRANSIT";
  const canCancel = status === "PENDING" || status === "IN_TRANSIT";

  async function handleReceive() {
    setActionLoading(true);
    try {
      await receiveStockTransferAction(transfer.id);
      addToast({ title: "Transfer received successfully", variant: "success" });
      setReceiveOpen(false);
      router.refresh();
    } catch (err) {
      addToast({
        title: "Failed to receive transfer",
        description: String(err),
        variant: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      await cancelStockTransferAction(transfer.id);
      addToast({ title: "Transfer cancelled", variant: "success" });
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      addToast({
        title: "Failed to cancel transfer",
        description: String(err),
        variant: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={transfer.referenceNumber}
        description={`Stock transfer detail`}
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
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  Transfer Items
                </CardTitle>
                <Badge
                  className={`border-0 ${STATUS_STYLES[status] || ""}`}
                  variant="outline"
                >
                  {status.replace(/_/g, " ")}
                </Badge>
              </div>
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
                      <TableCell className="text-right font-medium">
                        {Number(item.quantity)} {item.product.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {transfer.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {transfer.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                <Badge
                  className={`mt-1 border-0 ${STATUS_STYLES[status] || ""}`}
                  variant="outline"
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
                  <p className="mt-0.5 text-sm font-medium">
                    {transfer.sourceLocation.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {transfer.sourceLocation.code}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Destination Location
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {transfer.destinationLocation.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {transfer.destinationLocation.code}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{transfer.createdBy.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Created: {formatDate(transfer.createdAt)}</span>
                </div>
                {transfer.issuedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Issued: {formatDate(transfer.issuedAt)}</span>
                  </div>
                )}
                {transfer.receivedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Received: {formatDate(transfer.receivedAt)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {canReceive || canCancel ? (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {canReceive && (
                  <Button
                    className="w-full"
                    variant="success"
                    onClick={() => setReceiveOpen(true)}
                  >
                    <Package className="mr-2 h-4 w-4" /> Receive Transfer
                  </Button>
                )}
                {canCancel && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setCancelOpen(true)}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" /> Cancel Transfer
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        title="Receive Transfer"
        description={`Are you sure you want to receive "${transfer.referenceNumber}"? This will move stock from ${transfer.sourceLocation.name} to ${transfer.destinationLocation.name}.`}
        confirmText="Receive"
        confirmVariant="default"
        loading={actionLoading}
        onConfirm={handleReceive}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Transfer"
        description={`Are you sure you want to cancel "${transfer.referenceNumber}"? This action cannot be undone.`}
        confirmText="Cancel"
        confirmVariant="destructive"
        loading={actionLoading}
        onConfirm={handleCancel}
      />
    </div>
  );
}
