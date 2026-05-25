"use client";

import { useState } from "react";
import { Download, Search } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";

interface CustomerStatementClientProps {
  customers: { id: string; name: string }[];
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
  customer: { id: string; name: string; phone: string | null };
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  transactions: Transaction[];
}

export function CustomerStatementClient({ customers }: CustomerStatementClientProps) {
  const [customerId, setCustomerId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateStatement() {
    if (!customerId) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const params = new URLSearchParams({ customerId });
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/reports/customer-statement?${params}`);
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
    exportToCSV(rows, columns, `customer-statement-${data.customer.name}-${Date.now()}`);
  }

  function downloadPDF() {
    if (!customerId) return;
    const params = new URLSearchParams({ customerId, format: "pdf" });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    window.open(`/api/reports/customer-statement?${params}`, "_blank");
  }

  return (
    <div>
      <PageHeader title="Customer Statement" description="View detailed transaction history for a customer">
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={downloadPDF} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </PageHeader>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1.5 block text-sm font-medium">Customer</label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <label className="mb-1.5 block text-sm font-medium">From Date</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="min-w-[150px]">
              <label className="mb-1.5 block text-sm font-medium">To Date</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button onClick={generateStatement} disabled={!customerId || loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Generating..." : "Generate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{data.customer.name}</p>
                {data.customer.phone && (
                  <p className="text-xs text-muted-foreground">{data.customer.phone}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Opening Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={data.openingBalance > 0 ? "text-lg font-semibold text-red-600" : "text-lg font-semibold"}>
                  {formatCurrency(data.openingBalance)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Closing Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={data.closingBalance > 0 ? "text-lg font-semibold text-red-600" : "text-lg font-semibold"}>
                  {formatCurrency(data.closingBalance)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{data.transactions.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
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
                      <td className="px-4 py-3 text-muted-foreground" colSpan={3}>
                        Opening Balance
                      </td>
                      <td className="px-4 py-3 text-right" colSpan={2}></td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(data.openingBalance)}
                      </td>
                    </tr>
                    {data.transactions.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                          No transactions in this period
                        </td>
                      </tr>
                    ) : (
                      data.transactions.map((t, i) => (
                        <tr key={i} className="border-b text-sm hover:bg-muted/50">
                          <td className="px-4 py-3">{new Date(t.date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-mono text-xs">{t.reference}</td>
                          <td className="px-4 py-3 max-w-[200px] truncate">{t.description}</td>
                          <td className="px-4 py-3 text-right">{t.debit > 0 ? formatCurrency(t.debit) : "-"}</td>
                          <td className="px-4 py-3 text-right">{t.credit > 0 ? formatCurrency(t.credit) : "-"}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(t.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="font-semibold">
                      <td className="px-4 py-3" colSpan={3}>Closing Balance</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(data.totalDebits)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(data.totalCredits)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(data.closingBalance)}</td>
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
