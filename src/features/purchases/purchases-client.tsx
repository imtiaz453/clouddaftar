"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Truck, Eye, RotateCcw, FileText, Printer, Pencil, Undo2, Download, Search } from "lucide-react";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import type { PaginatedResponse } from "@/types";
import type { Product, Supplier, Purchase, PurchaseItem } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PurchaseDialog } from "./purchase-dialog";
import { ActionsMenu } from "@/components/shared/actions-menu";
import { type DataViewMode, ViewSwitcher } from "@/components/shared/view-switcher";

type PurchaseWithRelations = Purchase & {
  supplier: { name: string } | null;
  items: (PurchaseItem & { product: { name: string } })[];
};

interface PurchasesClientProps {
  purchases: PaginatedResponse<PurchaseWithRelations>;
  products: Product[];
  suppliers: Supplier[];
}

function getStatusVariant(status: string) {
  switch (status) {
    case "RECEIVED":
      return "success" as const;
    case "PENDING":
      return "warning" as const;
    case "DRAFT":
      return "secondary" as const;
    case "PARTIALLY_RECEIVED":
      return "default" as const;
    case "CANCELLED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function getPaymentStatusVariant(status: string) {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "PARTIALLY_PAID":
      return "warning" as const;
    case "UNPAID":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export function PurchasesClient({
  purchases: initialPurchases,
  products,
  suppliers,
}: PurchasesClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [detailPurchase, setDetailPurchase] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [viewMode, setViewMode] = useState<DataViewMode>("list");

  function openNewDialog() {
    setEditingPurchase(null);
    setDialogOpen(true);
  }

  function handleEdit(purchase: PurchaseWithRelations) {
    fetch(`/api/purchases/${purchase.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEditingPurchase(data.data);
          setDialogOpen(true);
        }
      });
  }

  async function openDetail(purchase: PurchaseWithRelations) {
    try {
      const res = await fetch(`/api/purchases/${purchase.id}`);
      const data = await res.json();
      if (data.success) setDetailPurchase(data.data);
      else setDetailPurchase(purchase);
    } catch {
      setDetailPurchase(purchase);
    }
    setDetailOpen(true);
  }

  async function handleReturn(purchaseId: string) {
    if (!confirm("Return this entire purchase to supplier? Stock will be deducted.")) return;
    setReturning(true);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return" }),
      });
      if (!res.ok) throw new Error("Failed to return");
      addToast({ title: "Purchase returned", variant: "success" });
      setDetailOpen(false);
      router.refresh();
    } catch {
      addToast({ title: "Error returning purchase", variant: "error" });
    } finally {
      setReturning(false);
    }
  }

  async function convertToDraft(purchase: PurchaseWithRelations) {
    if (!confirm(`Convert ${purchase.referenceNumber} to draft? Stock will be adjusted.`)) return;
    try {
      const res = await fetch(`/api/purchases/${purchase.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert-to-draft" }),
      });
      if (!res.ok) throw new Error();
      addToast({ title: "Converted to draft", variant: "success" });
      router.refresh();
    } catch {
      addToast({ title: "Error", variant: "error" });
    }
  }

  function exportPurchases() {
    const rows = initialPurchases.data.map((p) => ({
      referenceNumber: p.referenceNumber,
      supplier: p.supplier?.name || "Unknown",
      items: p.items.length,
      total: Number(p.total),
      paid: Number(p.paid),
      due: Number(p.due),
      dueDate: p.dueDate ? formatDate(p.dueDate) : "",
      paymentStatus: p.paymentStatus.replace("_", " "),
      status: p.status.replace("_", " "),
      date: formatDate(p.createdAt),
    }));
    exportToCSV(
      rows,
      [
        { key: "referenceNumber", label: "Reference" },
        { key: "supplier", label: "Supplier" },
        { key: "items", label: "Items" },
        { key: "total", label: "Total" },
        { key: "paid", label: "Paid" },
        { key: "due", label: "Due" },
        { key: "dueDate", label: "Due Date" },
        { key: "paymentStatus", label: "Payment" },
        { key: "status", label: "Status" },
        { key: "date", label: "Date" },
      ],
      `purchases-export-${Date.now()}`,
    );
  }

  function purchaseActions(purchase: PurchaseWithRelations) {
    return [
      { label: "View purchase", icon: Eye, onSelect: () => openDetail(purchase) },
      ...(purchase.status === "DRAFT"
        ? [{ label: "Edit purchase", icon: Pencil, onSelect: () => handleEdit(purchase) }]
        : []),
      {
        label: "Print A4",
        icon: Printer,
        onSelect: () =>
          window.open(
            `/api/purchase-orders/${purchase.id}?size=A4`,
            "_blank",
            "width=800,height=600",
          ),
      },
      {
        label: "Print thermal",
        icon: Printer,
        onSelect: () =>
          window.open(
            `/api/purchase-orders/${purchase.id}?size=THERMAL_80`,
            "_blank",
            "width=400,height=600",
          ),
      },
      ...((["RECEIVED", "PARTIALLY_RECEIVED"] as string[]).includes(purchase.status)
        ? [
            {
              label: "Return to supplier",
              icon: RotateCcw,
              onSelect: () => handleReturn(purchase.id),
              destructive: true,
              separatorBefore: true,
            },
          ]
        : []),
      ...(purchase.status === "RECEIVED"
        ? [
            {
              label: "Convert to draft",
              icon: Undo2,
              onSelect: () => convertToDraft(purchase),
              separatorBefore: true,
            },
          ]
        : []),
    ];
  }

  return (
    <div>
      <PageHeader title="Purchases" description="Manage purchase orders and suppliers">
        <Button size="sm" onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" /> New PO
        </Button>
        <ActionsMenu
          items={[
            { label: "Export CSV", icon: Download, onSelect: exportPurchases },
          ]}
        />
      </PageHeader>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by reference or supplier..."
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">
              {initialPurchases.total} purchase orders
            </p>
            <p className="text-xs text-muted-foreground">
              Review purchase orders as a list or visual kanban cards.
            </p>
          </div>
          <ViewSwitcher value={viewMode} onChange={setViewMode} />
        </div>
        {initialPurchases.data.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No purchases yet"
            description="Record your first purchase order"
            action={
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                New Purchase
              </Button>
            }
          />
        ) : viewMode === "kanban" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {initialPurchases.data.map((purchase) => (
              <div key={purchase.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-primary">
                      {purchase.referenceNumber}
                    </p>
                    <h3 className="mt-1 truncate text-base font-bold">
                      {purchase.supplier?.name || "Unknown"}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(purchase.createdAt)}
                    </p>
                    {purchase.dueDate && (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Due: {formatDate(purchase.dueDate)}
                      </p>
                    )}
                  </div>
                  <ActionsMenu compact items={purchaseActions(purchase)} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg bg-secondary/70 p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Total</p>
                    <p className="mt-1 font-bold">{formatCurrency(Number(purchase.total))}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/70 p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Paid</p>
                    <p className="mt-1 font-bold">{formatCurrency(Number(purchase.paid))}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/70 p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Due</p>
                    <p
                      className={
                        Number(purchase.due) > 0
                          ? "mt-1 font-bold text-destructive"
                          : "mt-1 font-bold"
                      }
                    >
                      {formatCurrency(Number(purchase.due))}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={getPaymentStatusVariant(purchase.paymentStatus)}>
                    {purchase.paymentStatus.replace("_", " ")}
                  </Badge>
                  <Badge variant={getStatusVariant(purchase.status)}>
                    {purchase.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="secondary">{purchase.items.length} items</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialPurchases.data.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {purchase.referenceNumber}
                  </TableCell>
                  <TableCell>{purchase.supplier?.name || "Unknown"}</TableCell>
                  <TableCell>{purchase.items.length}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(Number(purchase.total))}
                  </TableCell>
                  <TableCell>{formatCurrency(Number(purchase.paid))}</TableCell>
                  <TableCell className={Number(purchase.due) > 0 ? "font-medium text-red-600" : ""}>
                    {formatCurrency(Number(purchase.due))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {purchase.dueDate ? formatDate(purchase.dueDate) : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPaymentStatusVariant(purchase.paymentStatus)}>
                      {purchase.paymentStatus.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(purchase.status)}>
                      {purchase.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(purchase.createdAt)}
                  </TableCell>
                  <TableCell>
                    <ActionsMenu compact items={purchaseActions(purchase)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <PurchaseDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPurchase(null);
        }}
        products={products}
        suppliers={suppliers}
        purchase={editingPurchase}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Purchase {detailPurchase?.referenceNumber}
            </DialogTitle>
          </DialogHeader>
          {detailPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Supplier</p>
                  <p className="font-medium">{detailPurchase.supplier?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(detailPurchase.status)}>
                    {detailPurchase.status?.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p>{formatDate(detailPurchase.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p>{detailPurchase.dueDate ? formatDate(detailPurchase.dueDate) : "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment</p>
                  <div className="flex items-center gap-2">
                    <p>{detailPurchase.paymentMethod}</p>
                    <Badge
                      variant={getPaymentStatusVariant(detailPurchase.paymentStatus)}
                      className="text-xs"
                    >
                      {detailPurchase.paymentStatus.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Items</p>
                <div className="space-y-2">
                  {(detailPurchase.items || []).map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border p-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{item.product?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x {formatCurrency(Number(item.price))}
                        </p>
                      </div>
                      <span>{formatCurrency(Number(item.subtotal))}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold">{formatCurrency(Number(detailPurchase.total))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span>{formatCurrency(Number(detailPurchase.paid))}</span>
                </div>
                {Number(detailPurchase.due) > 0 && (
                  <div className="flex justify-between font-medium text-red-600">
                    <span>Due</span>
                    <span>{formatCurrency(Number(detailPurchase.due))}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    window.open(
                      `/api/purchase-orders/${detailPurchase.id}?size=A4`,
                      "_blank",
                      "width=800,height=600",
                    )
                  }
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print A4
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    window.open(
                      `/api/purchase-orders/${detailPurchase.id}?size=THERMAL_80`,
                      "_blank",
                      "width=400,height=600",
                    )
                  }
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Thermal
                </Button>
              </div>

              {detailPurchase.status === "RECEIVED" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    if (!confirm(`Convert ${detailPurchase.referenceNumber} to draft?`)) return;
                    try {
                      const res = await fetch(`/api/purchases/${detailPurchase.id}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "convert-to-draft" }),
                      });
                      if (!res.ok) throw new Error();
                      addToast({ title: "Converted to draft", variant: "success" });
                      setDetailOpen(false);
                      router.refresh();
                    } catch {
                      addToast({ title: "Error", variant: "error" });
                    }
                  }}
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  Convert to Draft
                </Button>
              )}
              {(["RECEIVED", "PARTIALLY_RECEIVED"] as string[]).includes(detailPurchase.status) && (
                <Button
                  variant="outline"
                  className="w-full text-orange-600"
                  onClick={() => handleReturn(detailPurchase.id)}
                  disabled={returning}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {returning ? "Returning..." : "Return to Supplier"}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
