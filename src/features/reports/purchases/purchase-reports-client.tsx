"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, DollarSign, Download, ShoppingBag, Truck } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportToCSV } from "@/lib/export-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";

type PurchaseReport = {
  summary: {
    totalSpend: number;
    taxableSpend: number;
    totalTax: number;
    totalDiscount: number;
    totalPaid: number;
    totalDue: number;
    totalOrders: number;
    averageOrderValue: number;
    activeSuppliers: number;
    unassignedSupplierOrders: number;
  };
  dailyData: { date: string; spend: number; orders: number }[];
  topSuppliers: {
    id: string;
    name: string;
    spend: number;
    paid: number;
    due: number;
    orders: number;
  }[];
  topProducts: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    spend: number;
    tax: number;
  }[];
  statusData: { status: string; orders: number; amount: number }[];
  recentPurchases: {
    id: string;
    referenceNumber: string;
    date: string;
    supplier: string;
    status: string;
    paymentStatus: string;
    total: number;
    paid: number;
    due: number;
  }[];
};

function defaultDateFrom() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function defaultDateTo() {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseReportsClient() {
  const { addToast } = useToast();
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [status, setStatus] = useState("POSTED");
  const [report, setReport] = useState<PurchaseReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (status) params.set("status", status);
      const res = await fetch(`/api/reports/purchases?${params.toString()}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load purchase report");
      }
      setReport(payload.data);
    } catch (error) {
      addToast({
        title: "Purchase report failed",
        description: error instanceof Error ? error.message : "Unable to generate purchase report",
        variant: "error",
      });
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, dateFrom, dateTo, status]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const metrics = useMemo(() => {
    const summary = report?.summary;
    return [
      {
        label: "Total spend",
        value: formatCurrency(summary?.totalSpend || 0),
        detail: `${summary?.totalOrders || 0} purchase orders`,
        icon: DollarSign,
      },
      {
        label: "Average order",
        value: formatCurrency(summary?.averageOrderValue || 0),
        detail: "Selected period",
        icon: Truck,
      },
      {
        label: "Paid / due",
        value: formatCurrency(summary?.totalPaid || 0),
        detail: `${formatCurrency(summary?.totalDue || 0)} due`,
        icon: ShoppingBag,
      },
      {
        label: "Suppliers",
        value: String(summary?.activeSuppliers || 0),
        detail: `${summary?.unassignedSupplierOrders || 0} unassigned orders`,
        icon: Building2,
      },
    ];
  }, [report]);

  function exportReport() {
    if (!report) return;
    exportToCSV(
      report.recentPurchases,
      [
        { key: "date", label: "Date" },
        { key: "referenceNumber", label: "Reference" },
        { key: "supplier", label: "Supplier" },
        { key: "status", label: "Status" },
        { key: "paymentStatus", label: "Payment Status" },
        { key: "total", label: "Total" },
        { key: "paid", label: "Paid" },
        { key: "due", label: "Due" },
      ],
      `purchase-report-${Date.now()}`,
    );
    addToast({ title: "Purchase report exported", variant: "success" });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="POSTED">Posted purchases</option>
                <option value="ALL">All purchase documents</option>
                <option value="PENDING">Pending</option>
                <option value="RECEIVED">Received</option>
                <option value="PARTIALLY_RECEIVED">Partially received</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" className="w-full" onClick={fetchReport} disabled={loading}>
                {loading && <LoadingSpinner size={4} className="mr-2" />}
                Refresh
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={exportReport}
                disabled={!report || loading}
                title="Export report"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums">{metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <LoadingSpinner size={4} />
            Loading purchase report...
          </CardContent>
        </Card>
      ) : !report ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No purchase report data could be loaded.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">Spend trend</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Status value</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.statusData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="status" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ReportTable title="Top suppliers">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No supplier purchases in this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.topSuppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="text-right">{supplier.orders}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(supplier.spend)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(supplier.due)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ReportTable>

            <ReportTable title="Top purchased products">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topProducts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No purchased products in this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.topProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <p className="font-medium">{product.name}</p>
                          {product.sku ? (
                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">{product.quantity}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.spend)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(product.tax)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ReportTable>
          </div>

          <ReportTable title="Recent purchases">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.recentPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No purchases found for the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  report.recentPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(purchase.date)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {purchase.referenceNumber}
                      </TableCell>
                      <TableCell className="font-medium">{purchase.supplier}</TableCell>
                      <TableCell>
                        <Badge variant={purchase.status === "RECEIVED" ? "success" : "secondary"}>
                          {purchase.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(purchase.total)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(purchase.due)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ReportTable>
        </>
      )}
    </div>
  );
}

function ReportTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-w-full overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}
