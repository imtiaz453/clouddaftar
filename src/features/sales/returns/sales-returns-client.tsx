"use client";

import { useState } from "react";
import { Search, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportToCSV } from "@/lib/export-utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface SalesReturnsClientProps {
  sales: any;
}

function getStatusVariant(status: string) {
  switch (status) {
    case "REFUNDED": return "destructive" as const;
    case "PARTIALLY_REFUNDED": return "warning" as const;
    case "CANCELLED": return "secondary" as const;
    default: return "secondary" as const;
  }
}

export function SalesReturnsClient({ sales }: SalesReturnsClientProps) {
  const [search, setSearch] = useState("");

  const allReturns = sales.data || [];
  const filtered = search
    ? allReturns.filter((s: any) => {
        const q = search.toLowerCase();
        return (
          (s.invoiceNumber || "").toLowerCase().includes(q) ||
          (s.customer?.name || "").toLowerCase().includes(q)
        );
      })
    : allReturns;

  const totalRefunded = filtered.reduce((s: number, r: any) => s + Number(r.total), 0);

  const exportColumns = [
    { key: "invoiceNumber", label: "Invoice" },
    { key: "customer.name", label: "Customer" },
    { key: "total", label: "Amount" },
    { key: "status", label: "Status" },
    { key: "createdAt", label: "Date" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Returns"
        description="View all refunded and cancelled sales"
      >
        <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered, exportColumns, "sales-returns")}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Returns</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Refunded</p>
          <p className="text-2xl font-bold">{formatCurrency(totalRefunded)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Full Refunds</p>
          <p className="text-2xl font-bold">{filtered.filter((s: any) => s.status === "REFUNDED").length}</p>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search returns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No returns found</TableCell></TableRow>
            ) : (
              filtered.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.invoiceNumber}</TableCell>
                  <TableCell>{s.customer?.name || "Walk-in"}</TableCell>
                  <TableCell className="text-sm">{formatDate(s.createdAt)}</TableCell>
                  <TableCell><Badge variant={getStatusVariant(s.status)}>{s.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(s.total))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
