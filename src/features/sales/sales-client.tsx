"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ShoppingCart,
  Eye,
  RotateCcw,
  FileText,
  Printer,
  Download,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Undo2,
} from "lucide-react";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, taxLabel } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import type { PaginatedResponse } from "@/types";
import type { Customer, Sale, SaleItem } from "@prisma/client";
import {
  LineItemEditor,
  LineItem,
  calculateTotals,
  applyScannedBarcode,
  type ProductOption,
} from "@/components/shared/line-item-editor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchInput } from "@/components/shared/search-input";
import { POSDialog } from "./pos-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ActionsMenu } from "@/components/shared/actions-menu";
import { type DataViewMode, ViewSwitcher } from "@/components/shared/view-switcher";

type SaleWithRelations = Sale & {
  customer: { name: string } | null;
  createdBy?: { name: string | null } | null;
  branch?: { name: string; code: string } | null;
  warehouse?: { name: string; code: string } | null;
  items: (SaleItem & { product: { name: string; sku: string | null } })[];
};

interface SalesClientProps {
  sales: PaginatedResponse<SaleWithRelations>;
  products: ProductOption[];
  customers: Customer[];
  defaultTaxRate?: number;
}

function getStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
      return "success" as const;
    case "PROFORMA":
      return "warning" as const;
    case "DRAFT":
      return "secondary" as const;
    case "CONFIRMED":
      return "default" as const;
    case "REFUNDED":
      return "destructive" as const;
    case "PARTIALLY_REFUNDED":
      return "warning" as const;
    case "CANCELLED":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "Draft Sales Order";
    case "CONFIRMED":
      return "Sales Order";
    case "PROFORMA":
      return "Proforma Invoice";
    case "COMPLETED":
      return "Invoice";
    case "PARTIALLY_REFUNDED":
      return "Partially Refunded";
    default:
      return status.replace(/_/g, " ");
  }
}

function getDocumentLabel(status: string) {
  if (status === "PROFORMA") return "proforma invoice";
  if (status === "DRAFT" || status === "CONFIRMED") return "sales order";
  return "invoice";
}

function canConvertToProforma(status: string) {
  return status === "DRAFT" || status === "CONFIRMED";
}

function canConvertToInvoice(status: string) {
  return status === "DRAFT" || status === "CONFIRMED" || status === "PROFORMA";
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

function formatPlace(sale: SaleWithRelations) {
  const branch = sale.branch
    ? `${sale.branch.name}${sale.branch.code ? ` (${sale.branch.code})` : ""}`
    : "";
  const warehouse = sale.warehouse
    ? `${sale.warehouse.name}${sale.warehouse.code ? ` (${sale.warehouse.code})` : ""}`
    : "";
  return [branch, warehouse].filter(Boolean).join(" / ") || "Not assigned";
}

export function SalesClient({
  sales: initialSales,
  products,
  customers,
  defaultTaxRate,
}: SalesClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [posOpen, setPosOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [detailSale, setDetailSale] = useState<SaleWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [detailItems, setDetailItems] = useState<LineItem[]>([]);
  const [detailBarcode, setDetailBarcode] = useState("");
  const detailBarcodeRef = useRef<HTMLInputElement>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const detailTotals = calculateTotals(detailItems, 0);
  const [sales, setSales] = useState(initialSales);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmVariant, setConfirmVariant] = useState<"destructive" | "default" | "warning">(
    "destructive",
  );
  const [viewMode, setViewMode] = useState<DataViewMode>("list");
  const pendingConfirm = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSales(initialSales);
    setPage(1);
  }, [initialSales]);

  async function loadPage(newPage: number) {
    setPage(newPage);
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?search=${search}&page=${newPage}&pageSize=50`);
      const data = await res.json();
      if (data.success) setSales(data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?search=${value}&page=1&pageSize=50`);
      const data = await res.json();
      if (data.success) setSales(data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function openNewSale() {
    setEditingSale(null);
    setPosOpen(true);
  }

  function handleEdit(sale: SaleWithRelations) {
    fetch(`/api/sales/${sale.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEditingSale(data.data);
          setPosOpen(true);
        }
      });
  }

  async function openDetail(sale: SaleWithRelations) {
    try {
      const res = await fetch(`/api/sales/${sale.id}`);
      const data = await res.json();
      if (data.success) {
        setDetailSale(data.data);
        setDetailOpen(true);
      }
    } catch {
      setDetailSale(sale);
      setDetailOpen(true);
    }
  }

  useEffect(() => {
    if (detailSale) {
      setDetailItems(
        (detailSale as any).items?.map((item: any) => {
          const product = products.find((p) => p.id === item.productId);
          return {
            id: item.id,
            productId: item.productId,
            productName: item.product?.name || product?.name || "Unknown",
            sku: item.product?.sku || product?.sku || "",
            barcode: product?.barcode || "",
            unit: product?.unit || "",
            quantity: item.quantity,
            price: Number(item.price),
            discount: Number(item.discount),
            tax: Number(item.tax),
            stock: product?.stock || 0,
          } as LineItem;
        }) || [],
      );
      setDetailBarcode("");
      requestAnimationFrame(() => detailBarcodeRef.current?.focus());
    }
  }, [detailSale, products]);

  useEffect(() => {
    const barcode = detailBarcode.trim();
    if (barcode.length > 0 && detailOpen) {
      const result = applyScannedBarcode(detailItems, products, barcode, defaultTaxRate);
      if (result.found) {
        setDetailItems(result.items);
        setDetailBarcode("");
        requestAnimationFrame(() => detailBarcodeRef.current?.focus());
      }
    }
  }, [detailBarcode, detailOpen, detailItems, products, defaultTaxRate]);

  async function handleDetailSave() {
    if (!detailSale) return;
    setDetailSaving(true);
    try {
      const validItems = detailItems.filter((i) => i.productId && i.quantity > 0);
      const res = await fetch(`/api/sales/${detailSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            tax: item.tax,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast({ title: "Sale updated", variant: "success" });
      setDetailOpen(false);
      await loadPage(page);
      router.refresh();
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
        variant: "error",
      });
    } finally {
      setDetailSaving(false);
    }
  }

  async function handleRefund(saleId: string) {
    setConfirmTitle("Refund Sale");
    setConfirmDescription(
      "Are you sure you want to refund this entire sale? Stock will be restored.",
    );
    setConfirmVariant("destructive");
    pendingConfirm.current = async () => {
      setRefunding(true);
      setConfirmOpen(false);
      try {
        const res = await fetch(`/api/sales/${saleId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "refund" }),
        });
        if (!res.ok) throw new Error("Failed to refund");
        addToast({ title: "Sale refunded", variant: "success" });
        setDetailOpen(false);
        router.refresh();
      } catch {
        addToast({ title: "Error processing refund", variant: "error" });
      } finally {
        setRefunding(false);
      }
    };
    setConfirmOpen(true);
  }

  function printInvoice(saleId: string) {
    window.open(`/api/invoices/${saleId}`, "_blank", "width=900,height=700");
  }

  function downloadInvoice(saleId: string) {
    window.open(`/api/invoices/${saleId}/pdf`, "_blank", "width=900,height=700");
  }

  function confirmConvertToDraft(sale: SaleWithRelations) {
    setConfirmTitle("Convert to Draft");
    setConfirmDescription(`Convert ${sale.invoiceNumber} to draft sales order?`);
    setConfirmVariant("warning");
    pendingConfirm.current = async () => {
      setConfirmOpen(false);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "convert-to-draft" }),
        });
        if (!res.ok) throw new Error();
        addToast({ title: "Converted to draft", variant: "success" });
        await loadPage(page);
        router.refresh();
      } catch {
        addToast({ title: "Error converting to draft", variant: "error" });
      }
    };
    setConfirmOpen(true);
  }

  function confirmConvertDocument(sale: SaleWithRelations, target: "proforma" | "invoice") {
    const targetLabel = target === "proforma" ? "proforma invoice" : "invoice";
    const action = target === "proforma" ? "convert-to-proforma" : "convert-to-invoice";
    setConfirmTitle(`Convert to ${target === "proforma" ? "Proforma" : "Invoice"}`);
    setConfirmDescription(`Convert ${sale.invoiceNumber} to ${targetLabel}?`);
    setConfirmVariant("default");
    pendingConfirm.current = async () => {
      setConfirmOpen(false);
      try {
        const res = await fetch(`/api/sales/${sale.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Conversion failed");
        addToast({ title: data.message || `Converted to ${targetLabel}`, variant: "success" });
        setDetailOpen(false);
        await loadPage(page);
        router.refresh();
      } catch (err) {
        addToast({
          title: "Error converting document",
          description: err instanceof Error ? err.message : undefined,
          variant: "error",
        });
      }
    };
    setConfirmOpen(true);
  }

  function saleActions(sale: SaleWithRelations) {
    const documentLabel = getDocumentLabel(sale.status);
    return [
      { label: `View ${documentLabel}`, icon: Eye, onSelect: () => openDetail(sale) },
      ...(sale.status === "DRAFT"
        ? [{ label: `Edit ${documentLabel}`, icon: Pencil, onSelect: () => handleEdit(sale) }]
        : []),
      { label: `Print ${documentLabel}`, icon: Printer, onSelect: () => printInvoice(sale.id) },
      { label: "Download PDF", icon: Download, onSelect: () => downloadInvoice(sale.id) },
      ...(canConvertToProforma(sale.status)
        ? [
            {
              label: "Convert to proforma",
              icon: FileText,
              onSelect: () => confirmConvertDocument(sale, "proforma"),
              separatorBefore: true,
            },
          ]
        : []),
      ...(canConvertToInvoice(sale.status)
        ? [
            {
              label: "Convert to invoice",
              icon: FileText,
              onSelect: () => confirmConvertDocument(sale, "invoice"),
              separatorBefore: !canConvertToProforma(sale.status),
            },
          ]
        : []),
      ...((["COMPLETED", "CONFIRMED", "PROFORMA"] as string[]).includes(sale.status)
        ? [
            {
              label: "Convert to draft",
              icon: Undo2,
              onSelect: () => confirmConvertToDraft(sale),
              separatorBefore:
                !canConvertToProforma(sale.status) && !canConvertToInvoice(sale.status),
            },
          ]
        : []),
      ...((["COMPLETED", "PARTIALLY_REFUNDED"] as string[]).includes(sale.status)
        ? [
            {
              label: "Refund invoice",
              icon: RotateCcw,
              onSelect: () => handleRefund(sale.id),
              destructive: true,
              separatorBefore: true,
            },
          ]
        : []),
    ];
  }

  return (
    <div>
      <PageHeader title="Sales" description="Manage sales orders, proforma invoices, and invoices">
        <Button onClick={openNewSale}>
          <Plus className="mr-2 h-4 w-4" />
          New Sale
        </Button>
        <ActionsMenu
          items={[
            {
              label: "Export Sales",
              icon: Download,
              onSelect: () => {
                const columns: ExportColumn[] = [
                  { key: "invoiceNumber", label: "Document #" },
                  { key: "customerName", label: "Customer" },
                  { key: "total", label: "Total" },
                  { key: "paid", label: "Paid" },
                  { key: "due", label: "Due" },
                  { key: "dueDate", label: "Due Date" },
                  { key: "status", label: "Status" },
                  { key: "createdAt", label: "Date" },
                ];
                const data = sales.data.map((s) => ({
                  invoiceNumber: s.invoiceNumber,
                  customerName: s.customer?.name || "Walk-in",
                  total: Number(s.total),
                  paid: Number(s.paid),
                  due: Number(s.due),
                  dueDate: s.dueDate ? new Date(s.dueDate).toLocaleDateString() : "",
                  status: getStatusLabel(s.status),
                  createdAt: new Date(s.createdAt).toLocaleDateString(),
                }));
                exportToCSV(data, columns, `sales-export-${Date.now()}`);
              },
            },
          ]}
        />
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          placeholder="Search by document number or customer..."
          value={search}
          onChange={handleSearch}
        />
        <ViewSwitcher value={viewMode} onChange={setViewMode} />
      </div>

      <Card className="p-4">
        {loading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : sales.data.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={search ? "No matching documents" : "No sales yet"}
            description={
              search
                ? "Try a different search term"
                : "Create your first sale to start tracking revenue"
            }
            action={
              <Button onClick={openNewSale}>
                <Plus className="mr-2 h-4 w-4" />
                New Sale
              </Button>
            }
          />
        ) : viewMode === "kanban" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sales.data.map((sale) => (
              <div key={sale.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-primary">{sale.invoiceNumber}</p>
                    <h3 className="mt-1 truncate text-base font-bold text-foreground">
                      {sale.customer?.name || "Walk-in"}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(sale.createdAt)}
                    </p>
                    {sale.dueDate && (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Due: {formatDate(sale.dueDate)}
                      </p>
                    )}
                    <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <p>Created by: {sale.createdBy?.name || "System"}</p>
                      <p>Place: {formatPlace(sale)}</p>
                    </div>
                  </div>
                  <ActionsMenu compact items={saleActions(sale)} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg bg-secondary/70 p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Total</p>
                    <p className="mt-1 font-bold">{formatCurrency(Number(sale.total))}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/70 p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Paid</p>
                    <p className="mt-1 font-bold">{formatCurrency(Number(sale.paid))}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/70 p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Due</p>
                    <p
                      className={
                        Number(sale.due) > 0 ? "mt-1 font-bold text-destructive" : "mt-1 font-bold"
                      }
                    >
                      {formatCurrency(Number(sale.due))}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant={getPaymentStatusVariant(sale.paymentStatus)}>
                    {sale.paymentStatus.replace("_", " ")}
                  </Badge>
                  <Badge variant={getStatusVariant(sale.status)}>
                    {getStatusLabel(sale.status)}
                  </Badge>
                  <Badge variant="secondary">{sale.items.length} items</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Place</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{taxLabel()}</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.data.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {sale.invoiceNumber}
                  </TableCell>
                  <TableCell>{sale.customer?.name || "Walk-in"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sale.createdBy?.name || "System"}
                  </TableCell>
                  <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                    {formatPlace(sale)}
                  </TableCell>
                  <TableCell>{sale.items.length}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(Number(sale.total))}
                  </TableCell>
                  <TableCell>{formatCurrency(Number(sale.paid))}</TableCell>
                  <TableCell className={Number(sale.due) > 0 ? "font-medium text-red-600" : ""}>
                    {formatCurrency(Number(sale.due))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sale.dueDate ? formatDate(sale.dueDate) : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPaymentStatusVariant(sale.paymentStatus)}>
                      {sale.paymentStatus.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(sale.status)}>
                      {getStatusLabel(sale.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(sale as any).taxComplianceMode &&
                    (sale as any).taxComplianceMode !== "NONE" ? (
                      <Badge
                        variant={
                          (sale as any).taxComplianceStatus === "VERIFIED" ? "success" : "secondary"
                        }
                        className="text-xs"
                      >
                        {(sale as any).taxComplianceMode === "FBR" ? "FBR" : "ZATCA"}
                        {(sale as any).taxComplianceStatus === "VERIFIED"
                          ? " ✓"
                          : (sale as any).taxComplianceStatus === "FAILED"
                            ? " ✗"
                            : ""}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(sale.createdAt)}
                  </TableCell>
                  <TableCell>
                    <ActionsMenu compact items={saleActions(sale)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {sales.totalPages > 1 && (
          <div className="flex items-center justify-between px-1 py-3">
            <p className="text-sm text-muted-foreground">
              Page {sales.page} of {sales.totalPages} ({sales.total} total)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={sales.page <= 1}
                onClick={() => loadPage(sales.page - 1)}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={sales.page >= sales.totalPages}
                onClick={() => loadPage(sales.page + 1)}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <POSDialog
        open={posOpen}
        onOpenChange={(open) => {
          setPosOpen(open);
          if (!open) setEditingSale(null);
        }}
        products={products}
        customers={customers}
        sale={editingSale}
        defaultTaxRate={defaultTaxRate}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(1200px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {detailSale ? `${getStatusLabel(detailSale.status)} ${detailSale.invoiceNumber}` : "Sale document"}
            </DialogTitle>
          </DialogHeader>
          {detailSale && (
            <div className="space-y-6">
              <section className="rounded-lg border bg-muted/20 p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Customer
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {detailSale.customer?.name || "Walk-in"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <Badge variant={getStatusVariant(detailSale.status)} className="mt-1">
                      {getStatusLabel(detailSale.status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
                    <p className="mt-1 text-sm font-medium">{formatDate(detailSale.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Due Date
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {detailSale.dueDate ? formatDate(detailSale.dueDate) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span>{detailSale.paymentMethod}</span>
                      <Badge
                        variant={getPaymentStatusVariant(detailSale.paymentStatus)}
                        className="text-xs"
                      >
                        {detailSale.paymentStatus.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Created By
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {detailSale.createdBy?.name || "System"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Place</p>
                    <p className="mt-1 text-sm font-medium">{formatPlace(detailSale)}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Items</h3>
                  <span className="text-xs text-muted-foreground">
                    {detailItems.length} line{detailItems.length === 1 ? "" : "s"}
                  </span>
                </div>
                <LineItemEditor
                  items={detailItems}
                  onChange={setDetailItems}
                  products={products}
                  showBarcode
                  barcodeInput={detailBarcode}
                  onBarcodeChange={setDetailBarcode}
                  barcodeRef={detailBarcodeRef as any}
                  defaultTaxRate={defaultTaxRate}
                />
              </section>

              {detailSale.notes && (
                <section className="rounded-lg bg-muted p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-1">{detailSale.notes}</p>
                </section>
              )}

              <section className="rounded-lg border border-primary/15 bg-gradient-to-br from-background to-muted/50 p-4">
                <div className="ml-auto w-full max-w-md space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(detailTotals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span>-{formatCurrency(detailTotals.totalDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{taxLabel()}</span>
                    <span>{formatCurrency(detailTotals.totalTax)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(detailTotals.grandTotal)}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid</span>
                      <span>{formatCurrency(Number(detailSale.paid))}</span>
                    </div>
                    {Number(detailSale.due) > 0 && (
                      <div className="flex justify-between text-sm font-medium text-red-600">
                        <span>Due</span>
                        <span>{formatCurrency(Number(detailSale.due))}</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button onClick={handleDetailSave} disabled={detailSaving}>
                  {detailSaving ? "Saving..." : "Save Changes"}
                </Button>

                <Button variant="outline" onClick={() => printInvoice(detailSale.id)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" onClick={() => downloadInvoice(detailSale.id)}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                {canConvertToProforma(detailSale.status) && (
                  <Button
                    variant="outline"
                    onClick={() => confirmConvertDocument(detailSale, "proforma")}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Convert to Proforma
                  </Button>
                )}
                {canConvertToInvoice(detailSale.status) && (
                  <Button
                    variant="outline"
                    onClick={() => confirmConvertDocument(detailSale, "invoice")}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Convert to Invoice
                  </Button>
                )}
                {(["COMPLETED", "CONFIRMED", "PROFORMA"] as string[]).includes(detailSale.status) && (
                  <Button
                    variant="outline"
                    onClick={() => confirmConvertToDraft(detailSale)}
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Convert to Draft
                  </Button>
                )}
                {(["COMPLETED", "PARTIALLY_REFUNDED"] as string[]).includes(detailSale.status) && (
                  <Button
                    variant="outline"
                    className="text-orange-600"
                    onClick={() => handleRefund(detailSale.id)}
                    disabled={refunding}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {refunding ? "Refunding..." : "Refund Sale"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmVariant={confirmVariant}
        confirmText="Confirm"
        onConfirm={() => pendingConfirm.current?.()}
      />
    </div>
  );
}
