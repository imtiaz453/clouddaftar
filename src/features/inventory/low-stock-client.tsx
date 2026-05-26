"use client";

import { useState } from "react";
import { Search, Package, AlertTriangle, Download } from "lucide-react";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface LowStockProduct {
  id: string; name: string; sku: string | null; stock: number; minStock: number;
  unit: string | null; purchasePrice: number; sellingPrice: number;
  category: { name: string } | null;
}

interface LowStockClientProps {
  products: LowStockProduct[];
}

export function LowStockClient({ products }: LowStockClientProps) {
  const [search, setSearch] = useState("");

  function exportCSV() {
    const columns: ExportColumn[] = [
      { key: "product", label: "Product" }, { key: "sku", label: "SKU" },
      { key: "category", label: "Category" },
      { key: "stock", label: "Current Stock" }, { key: "minStock", label: "Min Stock" },
      { key: "shortfall", label: "Shortfall" },
      { key: "purchasePrice", label: "Purchase Price" }, { key: "sellingPrice", label: "Selling Price" },
    ];
    const rows = filtered.map((p) => ({
      product: p.name, sku: p.sku || "", category: p.category?.name || "",
      stock: p.stock, minStock: p.minStock, shortfall: p.minStock - p.stock,
      purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice,
    }));
    exportToCSV(rows, columns, `low-stock-${Date.now()}`);
  }

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Card className="w-full sm:max-w-[200px] sm:flex-1">
          <CardHeader className="py-2"><CardTitle className="text-xs font-normal text-muted-foreground">Low Stock Items</CardTitle></CardHeader>
          <CardContent className="py-1"><p className="text-2xl font-bold text-amber-600">{products.length}</p></CardContent>
        </Card>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={exportCSV}><Download className="mr-1 h-3.5 w-3.5" />CSV</Button>
      </div>

      <Card className="p-0">
        {/* Mobile card view */}
        <div className="block sm:hidden">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {search ? "No products match your search" : "No low stock products found"}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((p) => (
                <div key={p.id} className="space-y-1 p-3">
                  <p className="text-sm font-medium">{p.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>SKU: {p.sku || "—"}</span>
                    <span>Category: {p.category?.name || "—"}</span>
                    <span className="font-bold text-red-600">Stock: {p.stock}</span>
                    <span>Min: {p.minStock}</span>
                    <span className="font-medium text-amber-600">Shortfall: {p.minStock - p.stock}</span>
                    <span>Buy: {formatCurrency(p.purchasePrice)}</span>
                    <span>Sell: {formatCurrency(p.sellingPrice)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Desktop table */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-right">Min Stock</TableHead>
                <TableHead className="text-right">Shortfall</TableHead>
                <TableHead className="text-right">Purchase Price</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {search ? "No products match your search" : "No low stock products found"}
                </TableCell></TableRow>
              ) : filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.sku || "—"}</TableCell>
                  <TableCell className="text-sm">{p.category?.name || "—"}</TableCell>
                  <TableCell className="text-right font-bold text-red-600">{p.stock}</TableCell>
                  <TableCell className="text-right">{p.minStock}</TableCell>
                  <TableCell className="text-right font-medium text-amber-600">{p.minStock - p.stock}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.purchasePrice)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.sellingPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
