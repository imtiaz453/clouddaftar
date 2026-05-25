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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SupplierPaymentsClientProps {
  payments: any;
  suppliers: any[];
}

export function SupplierPaymentsClient({ payments, suppliers }: SupplierPaymentsClientProps) {
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");

  const allPayments = payments.data || [];
  const filtered = allPayments.filter((p: any) => {
    if (!p.supplierId) return false;
    if (supplierFilter !== "all" && p.supplierId !== supplierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = p.supplier?.name || "";
      const ref = p.reference || "";
      return name.toLowerCase().includes(q) || ref.toLowerCase().includes(q);
    }
    return true;
  });

  const totalAmount = filtered.reduce((s: number, p: any) => s + Number(p.amount), 0);

  const exportColumns = [
    { key: "paymentDate", label: "Date" },
    { key: "supplier.name", label: "Supplier" },
    { key: "amount", label: "Amount" },
    { key: "paymentMethod", label: "Method" },
    { key: "reference", label: "Reference" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Payments"
        description="View all outgoing payments to suppliers"
      >
        <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered, exportColumns, "supplier-payments")}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Payments</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Average per Payment</p>
          <p className="text-2xl font-bold">{formatCurrency(filtered.length ? totalAmount / filtered.length : 0)}</p>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm" />
        </div>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All suppliers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No payments found</TableCell></TableRow>
            ) : (
              filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{formatDate(p.paymentDate)}</TableCell>
                  <TableCell className="font-medium">{p.supplier?.name || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{p.paymentMethod}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.reference || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(p.amount))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
