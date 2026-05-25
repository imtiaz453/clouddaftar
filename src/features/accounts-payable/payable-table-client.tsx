"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Eye, Download, ChevronLeft, ChevronRight, Truck, Search } from "lucide-react";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/shared/search-input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PayableDetailClient } from "./payable-detail-client";
import { SupplierPaymentDialog } from "./supplier-payment-dialog";
import type { PaginatedResponse } from "@/types";

interface PayableRow {
  id: string; referenceNumber: string; supplierName: string | null; purchaseDate: Date; dueDate: Date | null;
  total: number; paid: number; balance: number; overdueDays: number; status: string; supplierId: string | null; lastPaymentDate?: Date | null;
}

interface PayableTableClientProps {
  initialData: PaginatedResponse<PayableRow>;
  suppliers: { id: string; name: string }[];
}

function getStatusVariant(status: string) {
  switch (status) {
    case "PAID": return "success" as const;
    case "PARTIALLY_PAID": return "warning" as const;
    case "UNPAID": return "destructive" as const;
    default: return "secondary" as const;
  }
}

export function PayableTableClient({ initialData, suppliers }: PayableTableClientProps) {
  const { addToast } = useToast();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentPurchaseId, setPaymentPurchaseId] = useState<string | undefined>();
  const [paymentSupplierId, setPaymentSupplierId] = useState<string | undefined>();

  useEffect(() => { setData(initialData); setPage(1); }, [initialData]);

  const loadPage = useCallback(async (newPage: number) => {
    setPage(newPage); setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (supplierFilter !== "ALL") params.set("supplierId", supplierFilter);
      if (overdueOnly) params.set("overdueOnly", "true");
      params.set("page", newPage.toString());
      params.set("pageSize", "20");
      const res = await fetch(`/api/accounting/payables?${params}`);
      if (res.ok) { const d = await res.json(); if (d.success) setData(d.data); }
    } catch {} finally { setLoading(false); }
  }, [search, statusFilter, supplierFilter, overdueOnly]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value); setPage(1); setLoading(true);
    const params = new URLSearchParams();
    if (value) params.set("search", value);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (supplierFilter !== "ALL") params.set("supplierId", supplierFilter);
    if (overdueOnly) params.set("overdueOnly", "true");
    params.set("page", "1"); params.set("pageSize", "20");
    fetch(`/api/accounting/payables?${params}`).then(r => r.json()).then(d => { if (d.success) setData(d.data); }).finally(() => setLoading(false));
  }, [statusFilter, supplierFilter, overdueOnly]);

  const openDetail = async (id: string) => { setDetailId(id); setDetailOpen(true); };

  const handleExport = (format: "csv" | "xlsx") => {
    const columns: ExportColumn[] = [
      { key: "referenceNumber", label: "PO#" }, { key: "supplierName", label: "Supplier" },
      { key: "total", label: "Total" }, { key: "paid", label: "Paid" },
      { key: "balance", label: "Balance" }, { key: "overdueDays", label: "Overdue Days" },
      { key: "status", label: "Status" },
    ];
    const rows = data.data.map(r => ({ ...r, supplierName: r.supplierName || "" }));
    if (format === "csv") exportToCSV(rows, columns, `payables-export-${Date.now()}`);
    else exportToExcel(rows, columns, `payables-export-${Date.now()}`);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search PO# or supplier..." value={search} onChange={handleSearch} />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); loadPage(1); }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">All Status</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
        </select>
        <select
          value={supplierFilter}
          onChange={e => { setSupplierFilter(e.target.value); loadPage(1); }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">All Suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={overdueOnly} onChange={e => { setOverdueOnly(e.target.checked); loadPage(1); }} />
          Overdue Only
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-1 h-3.5 w-3.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")}><Download className="mr-1 h-3.5 w-3.5" />Excel</Button>
        </div>
      </div>

      <Card className="p-4">
        {loading ? (
          <div className="p-4"><TableSkeleton /></div>
        ) : data.data.length === 0 ? (
          <EmptyState icon={Truck} title={search ? "No matching payables" : "No payables yet"} description={search ? "Try a different search term" : "Create purchases to start tracking payables"} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO#</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => openDetail(row.id)}>
                    <TableCell className="font-mono text-xs font-medium">{row.referenceNumber}</TableCell>
                    <TableCell>{row.supplierName || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(row.purchaseDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.dueDate ? formatDate(row.dueDate) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.paid)}</TableCell>
                    <TableCell className={`text-right font-medium ${row.balance > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(row.balance)}</TableCell>
                    <TableCell>{row.overdueDays > 0 ? <Badge variant={row.overdueDays > 90 ? "destructive" : "warning"}>{row.overdueDays}d</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(row.status)}>{row.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(row.id)} title="View payable details"><Eye className="h-3.5 w-3.5" /></Button>
                        {row.balance > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600"
                            disabled={!row.supplierId}
                            onClick={() => { setPaymentPurchaseId(row.id); setPaymentSupplierId(row.supplierId || undefined); setPaymentDialogOpen(true); }}
                            title="Make payment"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between px-1 py-3">
                <p className="text-sm text-muted-foreground">Page {data.page} of {data.totalPages} ({data.total} total)</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => loadPage(data.page - 1)} title="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => loadPage(data.page + 1)} title="Next page"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(1200px,calc(100vw-2rem))]">
          <DialogHeader><DialogTitle>Purchase Detail</DialogTitle></DialogHeader>
          {detailId && <PayableDetailClient purchaseId={detailId} open={detailOpen} onOpenChange={setDetailOpen} onSuccess={() => loadPage(page)} />}
        </DialogContent>
      </Dialog>

      <SupplierPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        purchaseId={paymentPurchaseId}
        supplierId={paymentSupplierId}
        purchaseDue={data.data.find((row) => row.id === paymentPurchaseId)?.balance}
        onSuccess={() => loadPage(page)}
      />
    </div>
  );
}
