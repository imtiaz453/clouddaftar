"use client";

import { useState } from "react";
import { Download, Search, FileText, WalletCards, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";

interface SupplierStatementClientProps {
  suppliers: { id: string; name: string }[];
}

interface Transaction {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  status: string;
}

interface StatementData {
  supplier: { id: string; name: string; phone: string | null };
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  transactions: Transaction[];
}

export function SupplierStatementClient({ suppliers }: SupplierStatementClientProps) {
  const [supplierId, setSupplierId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateStatement() {
    if (!supplierId) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const params = new URLSearchParams({ supplierId });
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/reports/supplier-statement?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || "Failed to generate statement");
    } catch {
      setError("Failed to generate statement");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!data) return;
    const columns: ExportColumn[] = [
      { key: "date", label: "Date" },
      { key: "reference", label: "Reference" },
      { key: "description", label: "Description" },
      { key: "debit", label: "Debit" },
      { key: "credit", label: "Credit" },
      { key: "balance", label: "Balance" },
    ];
    const rows = data.transactions.map((t) => ({
      date: new Date(t.date).toLocaleDateString(),
      reference: t.reference,
      description: t.description,
      debit: formatCurrency(t.debit),
      credit: formatCurrency(t.credit),
      balance: formatCurrency(t.balance),
    }));
    exportToCSV(rows, columns, `supplier-statement-${data.supplier.name}-${Date.now()}`);
  }

  function downloadPDF() {
    if (!supplierId) return;
    const params = new URLSearchParams({ supplierId, format: "pdf" });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    window.open(`/api/reports/supplier-statement?${params}`, "_blank");
  }

  return (
    <div className="cd-page">
      <PageHeader title="Supplier Statement" description="Review opening balance, transaction movements, and closing balance in a clean responsive statement view">
        <Button variant="outline" onClick={exportCSV} disabled={!data}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button variant="outline" onClick={downloadPDF} disabled={!data}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </PageHeader>

      <Card className="cd-toolbar">
        <CardContent className="p-0">
          <div className="cd-form-grid">
            <div className="cd-form-field sm:col-span-2 lg:col-span-1">
              <label className="text-sm font-medium">Supplier</label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="cd-form-field">
              <label className="text-sm font-medium">From Date</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10" />
            </div>
            <div className="cd-form-field">
              <label className="text-sm font-medium">To Date</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10" />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={generateStatement} disabled={!supplierId || loading}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/60 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!data && !error && (
        <div className="cd-empty-hint">
          Select a supplier, choose an optional date range, then generate the statement.
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="cd-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cd-stat-label">Supplier</p>
                  <p className="mt-1 truncate text-lg font-semibold">{data.supplier.name}</p>
                  {data.supplier.phone && <p className="mt-1 text-xs text-muted-foreground">{data.supplier.phone}</p>}
                </div>
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="cd-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cd-stat-label">Opening</p>
                  <p className={cn("cd-stat-value tabular-nums", data.openingBalance > 0 && "text-red-600")}>{formatCurrency(data.openingBalance)}</p>
                </div>
                <WalletCards className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div className="cd-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cd-stat-label">Closing</p>
                  <p className={cn("cd-stat-value tabular-nums", data.closingBalance > 0 && "text-red-600")}>{formatCurrency(data.closingBalance)}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div className="cd-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="cd-stat-label">Transactions</p>
                  <p className="cd-stat-value tabular-nums">{data.transactions.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Debit {formatCurrency(data.totalDebits)} · Credit {formatCurrency(data.totalCredits)}</p>
                </div>
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/70 bg-muted/20">
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="lg:hidden">
                <div className="border-b border-border/70 p-4">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Opening Balance</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(data.openingBalance)}</span>
                  </div>
                </div>
                {data.transactions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No transactions in this period</div>
                ) : (
                  <div className="divide-y divide-border/70">
                    {data.transactions.map((t, i) => (
                      <div key={i} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()} · {t.reference}</p>
                          </div>
                          <div className="text-right text-sm tabular-nums">
                            <p className="font-semibold">{formatCurrency(t.balance)}</p>
                            <p className="text-xs text-muted-foreground">Balance</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-xl bg-muted/40 px-3 py-2">
                            <p className="text-xs text-muted-foreground">Debit</p>
                            <p className="font-medium tabular-nums">{t.debit > 0 ? formatCurrency(t.debit) : "-"}</p>
                          </div>
                          <div className="rounded-xl bg-muted/40 px-3 py-2">
                            <p className="text-xs text-muted-foreground">Credit</p>
                            <p className="font-medium tabular-nums">{t.credit > 0 ? formatCurrency(t.credit) : "-"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-border/70 p-4">
                  <div className="rounded-xl bg-primary/10 px-3 py-2 text-sm">
                    <div className="flex justify-between gap-3 font-semibold">
                      <span>Closing Balance</span>
                      <span className="tabular-nums">{formatCurrency(data.closingBalance)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="cd-table-scroll hidden lg:block">
                <table className="w-full min-w-[880px] text-sm">
                  <thead className="bg-muted/40">
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Reference</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 text-right font-medium">Debit</th>
                      <th className="px-4 py-3 text-right font-medium">Credit</th>
                      <th className="px-4 py-3 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b text-sm">
                      <td className="px-4 py-3 text-muted-foreground" colSpan={3}>Opening Balance</td>
                      <td className="px-4 py-3 text-right" colSpan={2} />
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(data.openingBalance)}</td>
                    </tr>
                    {data.transactions.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No transactions in this period</td>
                      </tr>
                    ) : (
                      data.transactions.map((t, i) => (
                        <tr key={i} className="border-b text-sm hover:bg-muted/40">
                          <td className="whitespace-nowrap px-4 py-3">{new Date(t.date).toLocaleDateString()}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{t.reference}</td>
                          <td className="max-w-[340px] truncate px-4 py-3">{t.description}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{t.debit > 0 ? formatCurrency(t.debit) : "-"}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{t.credit > 0 ? formatCurrency(t.credit) : "-"}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">{formatCurrency(t.balance)}</td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-4 py-3" colSpan={3}>Closing Balance</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(data.totalDebits)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(data.totalCredits)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(data.closingBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
