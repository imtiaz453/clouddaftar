"use client";

import { useState } from "react";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { exportToCSV } from "@/lib/export-utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface PurchaseReturnsClientProps {
  purchases: any;
}

export function PurchaseReturnsClient({ purchases }: PurchaseReturnsClientProps) {
  const [search, setSearch] = useState("");

  const allReturns = purchases.data || [];
  const filtered = search
    ? allReturns.filter((p: any) => {
        const q = search.toLowerCase();
        return (
          (p.referenceNumber || "").toLowerCase().includes(q) ||
          (p.supplier?.name || "").toLowerCase().includes(q)
        );
      })
    : allReturns;

  const totalReturned = filtered.reduce((s: number, p: any) => s + Number(p.total), 0);

  const exportColumns = [
    { key: "referenceNumber", label: "Reference" },
    { key: "supplier.name", label: "Supplier" },
    { key: "total", label: "Amount" },
    { key: "createdAt", label: "Date" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Returns"
        description="View all returned or cancelled purchases"
      >
        <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered, exportColumns, "purchase-returns")}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Returns</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">{formatCurrency(totalReturned)}</p>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Search returns..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No returns found</TableCell></TableRow>
            ) : (
              filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.referenceNumber}</TableCell>
                  <TableCell>{p.supplier?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{formatDate(p.createdAt)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(p.total))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
