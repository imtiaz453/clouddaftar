"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, Download, ChevronLeft, ChevronRight, FileText, Send, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { TableSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/providers/toast-provider";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import type { PaginatedResponse } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getReceivables, getReceivableDetail, sendPaymentReminder } from "@/actions/accounting";
import { ReceivePaymentDialog } from "./receive-payment-dialog";

type ReceivableRow = {
  id: string;
  invoiceNumber: string;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  createdAt: Date;
  dueDate: Date | null;
  total: number;
  paid: number;
  due: number;
  paymentStatus: string;
  status: string;
  lastPaymentDate: Date | null;
};

interface ReceivableTableClientProps {
  initialData: PaginatedResponse<ReceivableRow>;
  customers: { id: string; name: string }[];
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

function getStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
      return "success" as const;
    case "DRAFT":
      return "secondary" as const;
    case "CONFIRMED":
      return "default" as const;
    case "CANCELLED":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export function ReceivableTableClient({ initialData, customers }: ReceivableTableClientProps) {
  const { addToast } = useToast();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("_ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const status =
        statusFilter === "All"
          ? undefined
          : statusFilter === "Overdue Only"
            ? undefined
            : statusFilter;
      const overdueOnly = statusFilter === "Overdue Only";
      const result = await getReceivables({
        search: search || undefined,
        customerId: customerFilter === "_ALL" ? undefined : customerFilter,
        status,
        overdueOnly,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: 20,
      });
      setData(result);
    } catch {
      addToast({ title: "Error loading receivables", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, customerFilter, dateFrom, dateTo, page, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("All");
    setCustomerFilter("_ALL");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, []);

  async function openDetail(saleId: string) {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const result = await getReceivableDetail(saleId);
      setDetailData(result);
    } catch {
      addToast({ title: "Error loading invoice detail", variant: "error" });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!detailData?.id) return;
    const result = await getReceivableDetail(detailData.id);
    setDetailData(result);
    await fetchData();
  }

  async function handleSendReminder() {
    if (!detailData) return;
    if (Number(detailData.due) <= 0 || detailData.paymentStatus === "PAID") return;
    setSendingReminder(true);
    try {
      await sendPaymentReminder({
        saleId: detailData.id,
        customerId: detailData.customer?.id,
        type: "PAYMENT_DUE",
        message: `Reminder: Invoice ${detailData.invoiceNumber} of ${formatCurrency(detailData.due)} is due.`,
        contactMethod: "EMAIL",
      });
      addToast({ title: "Payment reminder sent", variant: "success" });
      await refreshDetail();
    } catch {
      addToast({ title: "Error sending reminder", variant: "error" });
    } finally {
      setSendingReminder(false);
    }
  }

  function openCustomerStatement() {
    if (!detailData?.customer?.id) return;
    const params = new URLSearchParams({ customerId: detailData.customer.id });
    window.open(`/api/reports/customer-statement?${params}&format=pdf`, "_blank");
  }

  async function loadPage(newPage: number) {
    setPage(newPage);
  }

  const getOverdueDays = (dueDate: Date | null): number => {
    if (!dueDate) return 0;
    const now = new Date();
    const due = new Date(dueDate);
    if (due >= now) return 0;
    return Math.floor((now.getTime() - due.getTime()) / 86400000);
  };

  function handleExport(format: "csv" | "excel") {
    const columns: ExportColumn[] = [
      { key: "invoiceNumber", label: "Invoice #" },
      { key: "customer", label: "Customer" },
      { key: "invoiceDate", label: "Invoice Date" },
      { key: "dueDate", label: "Due Date" },
      { key: "total", label: "Total" },
      { key: "paid", label: "Paid" },
      { key: "balance", label: "Balance" },
      { key: "overdueDays", label: "Overdue Days" },
      { key: "status", label: "Status" },
      { key: "lastPaymentDate", label: "Last Payment Date" },
    ];
    const exportData = data.data.map((row) => ({
      invoiceNumber: row.invoiceNumber,
      customer: row.customer?.name || "Walk-in",
      invoiceDate: formatDate(row.createdAt),
      dueDate: row.dueDate ? formatDate(row.dueDate) : "-",
      total: Number(row.total),
      paid: Number(row.paid),
      balance: Number(row.due),
      overdueDays: getOverdueDays(row.dueDate),
      status: row.paymentStatus.replace("_", " "),
      lastPaymentDate: row.lastPaymentDate ? formatDate(row.lastPaymentDate) : "-",
    }));
    const filename = `receivables-export-${Date.now()}`;
    if (format === "csv") {
      exportToCSV(exportData, columns, filename);
    } else {
      exportToExcel(exportData, columns, filename);
    }
    addToast({ title: `Exported as ${format.toUpperCase()}`, variant: "success" });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Receivables" description="All outstanding invoices and payments">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
        </div>
      </PageHeader>

      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search by invoice or customer..."
              value={search}
              onChange={handleSearch}
            />
          </div>
          <div className="w-full sm:w-40">
            <Label className="mb-1 block text-xs text-muted-foreground">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
                <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="Overdue Only">Overdue Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-44">
            <Label className="mb-1 block text-xs text-muted-foreground">Customer</Label>
            <Select
              value={customerFilter}
              onValueChange={(v) => {
                setCustomerFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_ALL">All Customers</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-36">
            <Label className="mb-1 block text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>
          <div className="w-full sm:w-36">
            <Label className="mb-1 block text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs">
            Reset
          </Button>
        </div>

        {loading ? (
          <div className="py-4">
            <TableSkeleton />
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              search || statusFilter !== "All" || customerFilter
                ? "No matching invoices"
                : "No receivables"
            }
            description={search ? "Try a different search term" : "All invoices have been paid"}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance/Due</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row) => {
                  const overdueDays = getOverdueDays(row.dueDate);
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(row.id)}
                    >
                      <TableCell className="font-mono text-xs font-medium">
                        {row.invoiceNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.customer?.name || "Walk-in"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.dueDate ? formatDate(row.dueDate) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.total)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.paid)}</TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          row.due > 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatCurrency(row.due)}
                      </TableCell>
                      <TableCell className="text-right">
                        {overdueDays > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">
                            {overdueDays}d
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getPaymentStatusVariant(row.paymentStatus)}
                          className="text-[10px]"
                        >
                          {row.paymentStatus.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.lastPaymentDate ? formatDate(row.lastPaymentDate) : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(row.id);
                          }}
                          title="View receivable details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {data.totalPages > 1 && (
          <div className="flex items-center justify-between px-1 pt-3">
            <p className="text-sm text-muted-foreground">
              Page {data.page} of {data.totalPages} ({data.total} total)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => loadPage(data.page - 1)}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => loadPage(data.page + 1)}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[min(1200px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {detailLoading ? "Loading..." : `Invoice ${detailData?.invoiceNumber || ""}`}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="p-6">
              <CardSkeleton />
            </div>
          ) : detailData ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Invoice {detailData.invoiceNumber}</h3>
                <Badge variant={getPaymentStatusVariant(detailData.paymentStatus)}>
                  {detailData.paymentStatus.replace("_", " ")}
                </Badge>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">Invoice Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{detailData.customer?.name || "Walk-in"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDate(detailData.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {detailData.dueDate ? formatDate(detailData.dueDate) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Status</p>
                    <Badge
                      variant={getPaymentStatusVariant(detailData.paymentStatus)}
                      className="text-[10px]"
                    >
                      {detailData.paymentStatus.replace("_", " ")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">{formatCurrency(detailData.total)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Paid</p>
                    <p className="font-medium">{formatCurrency(detailData.paid)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Balance Due</p>
                    <p className="font-bold text-red-600">{formatCurrency(detailData.due)}</p>
                  </div>
                </div>
              </div>

              {detailData.customer && (
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                    Customer Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{detailData.customer.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{detailData.customer.email || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{detailData.customer.phone || "-"}</p>
                    </div>
                  </div>
                </div>
              )}

              {detailData.payments && detailData.payments.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                    Payment History
                  </h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Allocated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.payments.map((pa: any) => (
                          <TableRow key={pa.id}>
                            <TableCell className="text-sm">
                              {formatDate(pa.payment.paymentDate)}
                            </TableCell>
                            <TableCell>{pa.payment.paymentMethod}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {pa.payment.reference || "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(pa.payment.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(pa.allocatedAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {detailData.due > 0 && (
                <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      Outstanding Amount
                    </p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(detailData.due)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {Number(detailData.due) > 0 && detailData.paymentStatus !== "PAID" && (
                  <Button
                    size="sm"
                    onClick={() => setPaymentOpen(true)}
                    disabled={!detailData.customer?.id}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Receive Payment
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendReminder}
                  disabled={
                    sendingReminder ||
                    !detailData.customer?.id ||
                    Number(detailData.due) <= 0 ||
                    detailData.paymentStatus === "PAID"
                  }
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Reminder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCustomerStatement}
                  disabled={!detailData.customer?.id}
                >
                  Print Statement
                </Button>
                <Button variant="outline" size="sm">
                  Add Note
                </Button>
              </div>

              {detailData.ledgerEntries && detailData.ledgerEntries.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">Ledger Entries</h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailData.ledgerEntries.map((entry: any) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm">{formatDate(entry.entryDate)}</TableCell>
                            <TableCell>{entry.type}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.description || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(entry.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {detailData.reminders && detailData.reminders.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                    Payment Reminders
                  </h4>
                  <div className="space-y-2">
                    {detailData.reminders.map((reminder: any) => (
                      <div key={reminder.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{reminder.type}</p>
                          <Badge variant={reminder.status === "SENT" ? "success" : "secondary"}>
                            {reminder.status}
                          </Badge>
                        </div>
                        {reminder.message && (
                          <p className="mt-1 text-muted-foreground">{reminder.message}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {reminder.remindedAt
                            ? formatDate(reminder.remindedAt)
                            : formatDate(reminder.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ReceivePaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        saleId={detailData?.id}
        customerId={detailData?.customer?.id}
        saleDue={Number(detailData?.due || 0)}
        invoiceNumber={detailData?.invoiceNumber}
        onSuccess={() => {
          setPaymentOpen(false);
          refreshDetail();
        }}
      />
    </div>
  );
}
