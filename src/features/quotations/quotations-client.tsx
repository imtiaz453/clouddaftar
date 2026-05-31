"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Eye,
  Send,
  Check,
  X,
  ArrowRightFromLine,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Search,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ActionsMenu } from "@/components/shared/actions-menu";
import { formatCurrency, formatDate, taxLabel } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  LineItemEditor,
  type LineItem,
  type ProductOption,
  calculateTotals,
  applyScannedBarcode,
} from "@/components/shared/line-item-editor";
import {
  DocumentFormHeader,
  DocumentFormSection,
  DocumentMetric,
  DocumentSummaryPanel,
  documentTextareaClassName,
} from "@/components/shared/document-form-layout";
import { dashboardHref } from "@/lib/dashboard-href";
import { usePathname, useRouter } from "next/navigation";

interface QuotationItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  subtotal: number;
  description?: string | null;
  product: { id: string; name: string; sku: string | null; unit: string | null };
}

interface Quotation {
  id: string;
  quoteNumber: string;
  customerId: string | null;
  companyId: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  validUntil: string | null;
  notes: string | null;
  terms: string | null;
  saleId: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
  items: QuotationItem[];
}

interface QuotationsClientProps {
  initialData: {
    data: Quotation[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  customers: { id: string; name: string }[];
  products: ProductOption[];
  defaultTaxRate?: number;
}

const statusVariants: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  SENT: "default",
  ACCEPTED: "success",
  CONVERTED_TO_SALE: "success",
  REJECTED: "destructive",
  EXPIRED: "outline",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  CONVERTED_TO_SALE: "Converted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

function isConvertibleQuotation(q: Pick<Quotation, "status" | "saleId">) {
  return !q.saleId && ["DRAFT", "SENT", "ACCEPTED"].includes(q.status);
}

export function QuotationsClient({
  initialData,
  customers,
  products,
  defaultTaxRate,
}: QuotationsClientProps) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<LineItem[]>([]);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailBarcode, setDetailBarcode] = useState("");
  const detailBarcodeRef = useRef<HTMLInputElement>(null);
  const detailTotals = calculateTotals(detailItems, 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmVariant, setConfirmVariant] = useState<"destructive" | "default" | "warning">(
    "destructive",
  );
  const [pendingConfirm, setPendingConfirm] = useState<(() => void) | null>(null);
  const { addToast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  function printQuotation(id: string) {
    window.open(`/api/quotations/${id}/print`, "_blank", "width=900,height=700");
  }

  function downloadQuotation(id: string) {
    window.open(`/api/quotations/${id}/pdf`, "_blank", "width=900,height=700");
  }

  function handleExport(format: "csv" | "excel") {
    const columns: ExportColumn[] = [
      { key: "quoteNumber", label: "Quote #" },
      { key: "customer", label: "Customer" },
      { key: "date", label: "Date" },
      { key: "validUntil", label: "Valid Until" },
      { key: "total", label: "Total" },
      { key: "status", label: "Status" },
    ];
    const rows = data.data.map((q) => ({
      quoteNumber: q.quoteNumber,
      customer: q.customer?.name || "Walk-in",
      date: formatDate(q.createdAt),
      validUntil: q.validUntil ? formatDate(q.validUntil) : "",
      total: q.total,
      status: statusLabels[q.status] || q.status,
    }));
    const fn = `quotations-${Date.now()}`;
    if (format === "csv") exportToCSV(rows, columns, fn);
    else exportToExcel(rows, columns, fn);
  }

  const loadPage = useCallback(
    async (newPage: number) => {
      setPage(newPage);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        params.set("page", newPage.toString());
        params.set("pageSize", "20");
        const res = await fetch(`/api/quotations?${params}`);
        if (res.ok) {
          const d = await res.json();
          if (d.success) setData(d.data);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter],
  );

  useEffect(() => {
    setPage(1);
    loadPage(1);
  }, [search, statusFilter]);

  const handleAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok) {
        addToast({
          title:
            action === "convert"
              ? d?.message || "Quotation converted to sales order"
              : d?.message || "Quotation updated",
          variant: "success",
        });
        loadPage(page);
        if (action === "convert") {
          setDetailId(null);
          router.push(dashboardHref(pathname, "/sales"));
        }
      } else {
        addToast({ title: d?.error || "Failed", variant: "error" });
      }
    } catch {
      addToast({ title: "Failed to update quotation", variant: "error" });
    }
  };

  const confirmConvertQuotation = (quotation: Quotation) => {
    setConfirmTitle("Convert to Sales Order");
    setConfirmDescription(`Convert ${quotation.quoteNumber} to a sales order?`);
    setConfirmVariant("warning");
    setPendingConfirm(() => () => {
      setConfirmOpen(false);
      handleAction(quotation.id, "convert");
    });
    setConfirmOpen(true);
  };

  function quotationActions(q: Quotation) {
    const items = [];
    items.push({ label: "View quotation", icon: Eye, onSelect: () => setDetailId(q.id) });
    items.push({ label: "Print quotation", icon: Printer, onSelect: () => printQuotation(q.id) });
    items.push({ label: "Download PDF", icon: Download, onSelect: () => downloadQuotation(q.id) });
    if (q.status === "DRAFT") {
      items.push({
        label: "Send quotation",
        icon: Send,
        onSelect: () => handleAction(q.id, "send"),
      });
    }
    if (q.status === "SENT") {
      items.push({
        label: "Accept quotation",
        icon: Check,
        onSelect: () => handleAction(q.id, "accept"),
      });
      items.push({
        label: "Reject quotation",
        icon: X,
        onSelect: () => handleAction(q.id, "reject"),
      });
    }
    if (isConvertibleQuotation(q)) {
      items.push({
        label: "Convert to sales order",
        icon: ArrowRightFromLine,
        onSelect: () => confirmConvertQuotation(q),
      });
    }
    if (q.status === "DRAFT" || q.status === "SENT") {
      items.push({
        label: "Delete quotation",
        icon: Trash2,
        onSelect: () => {
          setConfirmTitle("Delete Quotation");
          setConfirmDescription(`Delete ${q.quoteNumber}? This cannot be undone.`);
          setConfirmVariant("destructive");
          setPendingConfirm(() => () => {
            setConfirmOpen(false);
            handleAction(q.id, "delete");
          });
          setConfirmOpen(true);
        },
        destructive: true,
        separatorBefore: true,
      });
    }
    return items;
  }

  const handleDetailSave = async () => {
    if (!detail) return;
    const validItems = detailItems.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      addToast({ title: "Add at least one item", variant: "error" });
      return;
    }
    setDetailSaving(true);
    try {
      const res = await fetch(`/api/quotations/${detail.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            tax: item.tax,
            description: item.description || undefined,
          })),
        }),
      });
      if (res.ok) {
        addToast({ title: "Quotation updated", variant: "success" });
        setDetailId(null);
        loadPage(page);
      } else {
        const d = await res.json();
        addToast({ title: d.error || "Failed", variant: "error" });
      }
    } catch {
      addToast({ title: "Failed to update quotation", variant: "error" });
    } finally {
      setDetailSaving(false);
    }
  };

  const detail = detailId ? data.data.find((q) => q.id === detailId) : null;

  useEffect(() => {
    if (detail) {
      setDetailItems(
        detail.items.map((item) => {
          const product = (products as any[]).find((p: any) => p.id === item.productId);
          return {
            id: item.id,
            productId: item.productId,
            productName: item.product?.name || product?.name || "Unknown",
            sku: item.product?.sku || product?.sku || "",
            barcode: product?.barcode || "",
            unit: item.product?.unit || product?.unit || "",
            quantity: item.quantity,
            price: Number(item.price),
            discount: Number(item.discount),
            tax: Number(item.tax),
            stock: product?.stock || 0,
            description: item.description || "",
          } as LineItem;
        }),
      );
      setDetailBarcode("");
      requestAnimationFrame(() => detailBarcodeRef.current?.focus());
    }
  }, [detail]);

  useEffect(() => {
    const barcode = detailBarcode.trim();
    if (barcode.length > 0 && detailId) {
      const result = applyScannedBarcode(detailItems, products, barcode, defaultTaxRate);
      if (result.found) {
        setDetailItems(result.items);
        setDetailBarcode("");
        requestAnimationFrame(() => detailBarcodeRef.current?.focus());
      }
    }
  }, [detailBarcode, detailId, detailItems, products, defaultTaxRate]);

  return (
    <div className="space-y-4">
      <PageHeader title="Quotations" description="Create and manager customer quotations">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Quotation
        </Button>
        <ActionsMenu
          items={[
            { label: "Export CSV", icon: Download, onSelect: () => handleExport("csv") },
            { label: "Export Excel", icon: Download, onSelect: () => handleExport("excel") },
          ]}
        />
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search quotations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-9 w-[140px] rounded-md border border-input bg-background px-3 text-xs"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="block sm:hidden">
              {data.data.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No quotations found
                </div>
              ) : (
                <div className="divide-y">
                  {data.data.map((q) => (
                    <div key={q.id} className="space-y-1.5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{q.quoteNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {q.customer?.name || "Walk-in"}
                          </p>
                        </div>
                        <Badge
                          variant={statusVariants[q.status] || "secondary"}
                          className="shrink-0 text-xs"
                        >
                          {statusLabels[q.status] || q.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDate(q.createdAt)}</span>
                        <span>Valid: {q.validUntil ? formatDate(q.validUntil) : "-"}</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(q.total)}
                        </span>
                      </div>
                      <ActionsMenu compact items={quotationActions(q)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No quotations found
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.data.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">{q.quoteNumber}</TableCell>
                        <TableCell>{q.customer?.name || "Walk-in"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(q.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {q.validUntil ? formatDate(q.validUntil) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(q.total)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusVariants[q.status] || "secondary"}
                            className="text-xs"
                          >
                            {statusLabels[q.status] || q.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ActionsMenu compact items={quotationActions(q)} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">{data.total} total</p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => loadPage(page - 1)}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.data.length < 20}
                  onClick={() => loadPage(page + 1)}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Dialog
        open={!!detailId}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setDetailItems([]);
          }
        }}
      >
        <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(1200px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Quotation {detail?.quoteNumber}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-6">
              <section className="rounded-lg border bg-muted/20 p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Customer
                    </p>
                    <p className="mt-1 text-sm font-medium">{detail.customer?.name || "Walk-in"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <Badge variant={statusVariants[detail.status]} className="mt-1">
                      {statusLabels[detail.status]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
                    <p className="mt-1 text-sm font-medium">{formatDate(detail.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Valid Until
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {detail.validUntil ? formatDate(detail.validUntil) : "-"}
                    </p>
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

              {(detail.notes || detail.terms) && (
                <section className="grid gap-3 md:grid-cols-2">
                  {detail.notes && (
                    <div className="rounded-lg bg-muted p-4 text-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                      <p className="mt-1">{detail.notes}</p>
                    </div>
                  )}
                  {detail.terms && (
                    <div className="rounded-lg bg-muted p-4 text-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Terms</p>
                      <p className="mt-1 whitespace-pre-wrap">{detail.terms}</p>
                    </div>
                  )}
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
                    <span className={detailTotals.totalDiscount > 0 ? "text-red-600" : ""}>
                      -{formatCurrency(detailTotals.totalDiscount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{taxLabel()}</span>
                    <span>{formatCurrency(detailTotals.totalTax)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3 text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(detailTotals.grandTotal)}</span>
                  </div>
                </div>
              </section>

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                {isConvertibleQuotation(detail) && (
                  <Button variant="outline" onClick={() => confirmConvertQuotation(detail)}>
                    <ArrowRightFromLine className="mr-2 h-4 w-4" /> Convert to Sales Order
                  </Button>
                )}
                <Button variant="outline" onClick={() => printQuotation(detail.id)}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button variant="outline" onClick={() => downloadQuotation(detail.id)}>
                  <Download className="mr-2 h-4 w-4" /> PDF
                </Button>
                <Button onClick={handleDetailSave} disabled={detailSaving}>
                  {detailSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateQuotationDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        customers={customers as any}
        products={products as any}
        onSuccess={() => {
          setShowCreate(false);
          loadPage(1);
        }}
        defaultTaxRate={defaultTaxRate}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmVariant={confirmVariant}
        onConfirm={() => pendingConfirm?.()}
      />
    </div>
  );
}

function CreateQuotationDialog({
  open,
  onOpenChange,
  customers,
  products,
  onSuccess,
  defaultTaxRate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customers: { id: string; name: string }[];
  products: ProductOption[];
  onSuccess: () => void;
  defaultTaxRate?: number;
}) {
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<LineItem[]>([
    {
      id: "1",
      productId: "",
      productName: "",
      sku: "",
      barcode: "",
      unit: "",
      quantity: 1,
      price: 0,
      discount: 0,
      tax: 0,
      stock: 0,
      description: "",
    },
  ]);
  const [saving, setSaving] = useState(false);
  const pathname = usePathname();
  const { addToast } = useToast();

  function handleCustomerChange(value: string) {
    if (value === "__create_customer__") {
      window.location.assign(dashboardHref(pathname, "/customers"));
      return;
    }
    setCustomerId(value);
  }

  const handleSave = async () => {
    const validItems = items.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      addToast({ title: "Add at least one item", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          items: validItems.map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
            price: c.price,
            discount: c.discount,
            tax: c.tax,
            description: c.description || undefined,
          })),
          discount,
          notes,
          terms,
          validUntil: validUntil || undefined,
          status: "DRAFT",
        }),
      });
      if (res.ok) {
        addToast({ title: "Quotation created", variant: "success" });
        onSuccess();
        reset();
      } else {
        const d = await res.json();
        addToast({ title: d.error || "Failed", variant: "error" });
      }
    } catch {
      addToast({ title: "Failed to create quotation", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setCustomerId("");
    setDiscount(0);
    setNotes("");
    setTerms("");
    setValidUntil("");
    setItems([
      {
        id: "1",
        productId: "",
        productName: "",
        sku: "",
        barcode: "",
        unit: "",
        quantity: 1,
        price: 0,
        discount: 0,
        tax: 0,
        stock: 0,
        description: "",
      },
    ]);
  };

  const totals = calculateTotals(items, discount);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(1200px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="sr-only">New Quotation</DialogTitle>
          <DocumentFormHeader
            title="New Quotation"
            subtitle="Prepare a customer offer with validity, editable line taxes, notes, and print-ready terms."
          >
            <DocumentMetric label="Lines" value={items.filter((i) => i.productId).length} />
            <DocumentMetric label={taxLabel()} value={formatCurrency(totals.totalTax)} />
            <DocumentMetric
              label="Quote Total"
              value={formatCurrency(totals.grandTotal)}
              tone="success"
            />
          </DocumentFormHeader>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          <DocumentFormSection
            title="Quote Details"
            description="Choose the customer, validity date, and any overall commercial discount."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-xs">Customer</Label>
                <select
                  value={customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__create_customer__">+ Create new customer</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Valid Until</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Overall Discount</Label>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="h-9"
                />
              </div>
            </div>
          </DocumentFormSection>

          <DocumentFormSection
            title="Items"
            description="Build the quotation from products or services and override unit price, discount, and tax where needed."
            actions={
              <span className="text-xs text-muted-foreground">
                {totals.itemCount} line{totals.itemCount === 1 ? "" : "s"}
              </span>
            }
            contentClassName="space-y-3"
          >
            <LineItemEditor
              items={items}
              onChange={setItems}
              products={products}
              showStock
              showBarcode={false}
              defaultTaxRate={defaultTaxRate}
            />
          </DocumentFormSection>

          <DocumentFormSection
            title="Customer-Facing Text"
            description="These notes and terms are saved with the quotation and shown on print/PDF output."
            contentClassName="grid gap-4 md:grid-cols-2"
          >
            <div>
              <Label className="text-xs">Notes</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Scope, delivery expectations, or internal reference..."
                className={documentTextareaClassName}
              />
            </div>
            <div>
              <Label className="text-xs">Terms & Conditions</Label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Validity, acceptance, payment schedule, warranty, or exclusions..."
                className={documentTextareaClassName}
              />
            </div>
          </DocumentFormSection>

          <DocumentSummaryPanel>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span>{totals.itemCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className={totals.totalDiscount > 0 ? "text-red-600" : ""}>
                -{formatCurrency(totals.totalDiscount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{taxLabel()}</span>
              <span>{formatCurrency(totals.totalTax)}</span>
            </div>
            <div className="flex justify-between border-t pt-3 text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </DocumentSummaryPanel>

          <DialogFooter className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Quotation"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
