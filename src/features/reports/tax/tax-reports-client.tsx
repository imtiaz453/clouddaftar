"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Percent, TrendingDown, TrendingUp } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Bar, BarChart, CartesianGrid,
  Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { exportToCSV } from "@/lib/export-utils";
import { formatCurrency, taxLabel } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";

type TaxReport = {
  summary: {
    taxCollected: number;
    taxPaid: number;
    netLiability: number;
    taxableSales: number;
    taxablePurchases: number;
    avgTaxRate: number;
    salesCount: number;
    purchaseCount: number;
  };
  monthlyData: { month: string; collected: number; paid: number }[];
  recentTransactions: {
    date: string; type: "SALE" | "PURCHASE";
    number: string; entity: string;
    tax: number; total: number;
  }[];
};

function defaultDateFrom() {
  const date = new Date(); date.setDate(1); return date.toISOString().slice(0, 10);
}
function defaultDateTo() {
  return new Date().toISOString().slice(0, 10);
}

export function TaxReportsClient() {
  const { addToast } = useToast();
  const label = taxLabel();
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [report, setReport] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/reports/tax?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load");
      setReport(json.data);
    } catch (err) {
      addToast({ title: "Failed to load tax report", description: (err as Error).message, variant: "error" });
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function exportReport() {
    if (!report) return;
    const rows = report.recentTransactions.map((t) => ({
      Date: new Date(t.date).toLocaleDateString(),
      Type: t.type,
      "#": t.number,
      Entity: t.entity,
      Tax: t.tax,
      Total: t.total,
    }));
    exportToCSV(
      rows as any,
      [
        { key: "Date", label: "Date" },
        { key: "Type", label: "Type" },
        { key: "#", label: "#" },
        { key: "Entity", label: "Entity" },
        { key: "Tax", label: "Tax" },
        { key: "Total", label: "Total" },
      ],
      "tax-report",
    );
  }

  const metrics = [
    { label: `${label} Collected (Sales)`, value: formatCurrency(report?.summary.taxCollected ?? 0), icon: TrendingUp },
    { label: `${label} Paid (Purchases)`, value: formatCurrency(report?.summary.taxPaid ?? 0), icon: TrendingDown },
    { label: `Net ${label} Liability`, value: formatCurrency(report?.summary.netLiability ?? 0), icon: FileText },
    { label: `Avg ${label} Rate`, value: `${report?.summary.avgTaxRate ?? 0}%`, icon: Percent },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs">From</Label>
          <Input id="from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs">To</Label>
          <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" />
        </div>
        <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
          {loading && <LoadingSpinner size={4} className="mr-2" />} Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={exportReport} disabled={!report}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <LoadingSpinner size={6} />
          </CardContent>
        </Card>
      ) : !report ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Could not load {label.toLowerCase()} report. Try again later.
          </CardContent>
        </Card>
      ) : (
        <>
          {report.monthlyData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly {label} Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-xs text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="text-xs text-muted-foreground" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} name="Collected" />
                    <Line type="monotone" dataKey="paid" stroke="#ef4444" strokeWidth={2} name="Paid" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead className="text-right">{label}</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.recentTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.recentTransactions.map((t, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{new Date(t.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={t.type === "SALE" ? "default" : "secondary"}>{t.type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{t.number}</TableCell>
                          <TableCell>{t.entity}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(t.tax)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
