"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, FileText } from "lucide-react";
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

interface LedgerEntry {
  id: string;
  entryDate: Date;
  type: string;
  referenceNumber: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
}

interface CustomerLedgerClientProps {
  customerId: string;
  initialData: {
    entries: LedgerEntry[];
    customer: { id: string; name: string; email?: string | null; phone?: string | null };
    summary: { totalDebit: number; totalCredit: number; balance: number };
  };
}

const typeVariants: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  INVOICE: "default",
  PAYMENT: "success",
  RETURN: "warning",
  ADJUSTMENT: "secondary",
  PURCHASE: "destructive",
  OPENING_BALANCE: "outline",
};

const typeLabels: Record<string, string> = {
  INVOICE: "Invoice",
  PAYMENT: "Payment",
  RETURN: "Return",
  ADJUSTMENT: "Adjustment",
  PURCHASE: "Purchase",
  OPENING_BALANCE: "Opening Balance",
};

export function CustomerLedgerClient({ customerId, initialData }: CustomerLedgerClientProps) {
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
        params.set("pageSize", "30");
        const res = await fetch(`/api/accounting/ledger/customer/${customerId}?${params}`);
        if (res.ok) {
          const d = await res.json();
          if (d.success) setData(d.data);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [customerId, dateFrom, dateTo],
  );

  const handleFilter = () => {
    setPage(1);
    loadPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{data.customer.name}</h2>
          <p className="text-sm text-muted-foreground">
            {data.customer.email || data.customer.phone || ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p
            className={`text-2xl font-bold ${data.summary.balance > 0 ? "text-red-600" : data.summary.balance < 0 ? "text-green-600" : ""}`}
          >
            {formatCurrency(Math.abs(data.summary.balance))}
            {data.summary.balance > 0 ? " Dr" : data.summary.balance < 0 ? " Cr" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Debit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(data.summary.totalDebit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total Credit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(data.summary.totalCredit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Net Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-lg font-bold ${data.summary.balance > 0 ? "text-red-600" : data.summary.balance < 0 ? "text-green-600" : ""}`}
            >
              {formatCurrency(Math.abs(data.summary.balance))}
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
        <Button size="sm" variant="outline" className="ml-auto">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Set Opening Balance
        </Button>
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
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No ledger entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.entryDate)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={typeVariants[entry.type] || "secondary"}
                          className="text-xs"
                        >
                          {typeLabels[entry.type] || entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.referenceNumber || "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {entry.description || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${entry.balance > 0 ? "text-red-600" : entry.balance < 0 ? "text-green-600" : ""}`}
                      >
                        {formatCurrency(Math.abs(entry.balance))}
                        {entry.balance > 0 ? " Dr" : entry.balance < 0 ? " Cr" : ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">{data.entries.length} entries</p>
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
                  disabled={data.entries.length < 30}
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
