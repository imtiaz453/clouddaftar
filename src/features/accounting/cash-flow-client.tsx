"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CashFlowEntry {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  type: "INFLOW" | "OUTFLOW";
  entityName: string;
  reference: string | null;
  notes: string | null;
  customer: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
}

interface CashFlowClientProps {
  initialData: {
    data: CashFlowEntry[];
    summary: { totalInflow: number; totalOutflow: number; netCashFlow: number };
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  EASYPAISA: "Easypaisa",
  JAZZCASH: "JazzCash",
  ONLINE_TRANSFER: "Online Transfer",
};

export function CashFlowClient({ initialData }: CashFlowClientProps) {
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setData(initialData);
    setPage(1);
  }, [initialData]);

  const loadPage = useCallback(
    async (newPage: number) => {
      setPage(newPage);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        params.set("page", newPage.toString());
        params.set("pageSize", "50");
        const res = await fetch(`/api/accounting/cash-flow?${params}`);
        if (res.ok) {
          const d = await res.json();
          if (d.success) setData(d.data);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo],
  );

  function handleExport(format: "csv" | "excel") {
    const columns: ExportColumn[] = [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "entity", label: "Entity" },
      { key: "method", label: "Method" },
      { key: "reference", label: "Reference" },
      { key: "amount", label: "Amount" },
      { key: "notes", label: "Notes" },
    ];
    const rows = data.data.map((e) => ({
      date: formatDate(e.paymentDate),
      type: e.type === "INFLOW" ? "Payment Received" : "Payment Made",
      entity: e.entityName,
      method: methodLabels[e.paymentMethod] || e.paymentMethod,
      reference: e.reference || "",
      amount: e.type === "INFLOW" ? e.amount : -e.amount,
      notes: e.notes || "",
    }));
    const fn = `cash-flow-${Date.now()}`;
    if (format === "csv") exportToCSV(rows, columns, fn);
    else exportToExcel(rows, columns, fn);
  }

  const handleFilter = () => {
    setPage(1);
    loadPage(1);
  };
  const { summary } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Total Inflow
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalInflow)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Total Outflow
            </CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalOutflow)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Net Cash Flow
            </CardTitle>
            <ArrowUpRight
              className={`h-4 w-4 ${summary.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}
            />
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${summary.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(Math.abs(summary.netCashFlow))}
              {summary.netCashFlow >= 0 ? " (surplus)" : " (deficit)"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8"
          />
        </div>
        <Button size="sm" onClick={handleFilter}>
          Filter
        </Button>
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.paymentDate)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entry.type === "INFLOW" ? "success" : "destructive"}
                          className="text-xs"
                        >
                          {entry.type === "INFLOW" ? "Payment Received" : "Payment Made"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{entry.entityName}</TableCell>
                      <TableCell className="text-xs">
                        {methodLabels[entry.paymentMethod] || entry.paymentMethod}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{entry.reference || "—"}</TableCell>
                      <TableCell
                        className={`text-right font-medium ${entry.type === "INFLOW" ? "text-green-600" : "text-red-600"}`}
                      >
                        {entry.type === "INFLOW" ? "+" : "-"}
                        {formatCurrency(entry.amount)}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                        {entry.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">{data.total} transactions</p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => loadPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.data.length < 50}
                  onClick={() => loadPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
