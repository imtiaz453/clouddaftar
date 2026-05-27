"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, Loader2, Package, PackageX, TrendingUp, DollarSign } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { exportToCSV } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";

type InventoryReport = {
  summary: {
    totalProducts: number;
    activeProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalStockValue: number;
    totalSellingValue: number;
    categoriesCount: number;
  };
  categoryBreakdown: { category: string; productCount: number; stockValue: number }[];
  lowStockAlerts: { id: string; name: string; sku: string | null; stock: number; minStock: number; stockValue: number }[];
  recentMovements: { date: string; product: string; type: string; quantity: number; reference: string }[];
};

const CATEGORY_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
];

export function InventoryReportsClient() {
  const { addToast } = useToast();
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/inventory");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load");
      setReport(json.data);
    } catch (err) {
      addToast({ title: "Failed to load inventory report", description: (err as Error).message, variant: "error" });
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function exportReport() {
    if (!report) return;
    const rows = report.lowStockAlerts.map((p) => ({
      "Product Name": p.name,
      SKU: p.sku || "-",
      "Current Stock": p.stock,
      "Min Stock": p.minStock,
      "Stock Value": p.stockValue,
    }));
    exportToCSV(
      rows as any,
      [
        { key: "Product Name", label: "Product Name" },
        { key: "SKU", label: "SKU" },
        { key: "Current Stock", label: "Current Stock" },
        { key: "Min Stock", label: "Min Stock" },
        { key: "Stock Value", label: "Stock Value" },
      ],
      "inventory-report",
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Could not load inventory report. Try again later.
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: "Total Products", value: report.summary.totalProducts, icon: Package },
    { label: "Low Stock Items", value: report.summary.lowStockItems, icon: AlertTriangle },
    { label: "Stock Value", value: formatCurrency(report.summary.totalStockValue), icon: DollarSign },
    { label: "Out of Stock", value: report.summary.outOfStockItems, icon: PackageX },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {report.summary.activeProducts} active products across {report.summary.categoriesCount} categories
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            <Loader2 className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportReport} disabled={report.lowStockAlerts.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
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

      {report.categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock Value by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.categoryBreakdown} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11 }}
                  angle={-25}
                  textAnchor="end"
                  className="text-xs text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 11 }} className="text-xs text-muted-foreground" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="stockValue" radius={[4, 4, 0, 0]}>
                  {report.categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Low Stock Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.lowStockAlerts.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No low stock items found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Min Stock</TableHead>
                    <TableHead className="text-right">Stock Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.lowStockAlerts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.sku || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.stock === 0 ? "destructive" : "warning"}>{p.stock}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{p.minStock}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.stockValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {report.recentMovements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Stock Movements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.recentMovements.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{new Date(m.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{m.product}</TableCell>
                      <TableCell>
                        <Badge variant={m.type === "SALE" ? "destructive" : m.type === "PURCHASE" ? "default" : "secondary"}>
                          {m.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${m.quantity < 0 ? "text-red-600" : "text-green-600"}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.reference}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
