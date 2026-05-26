"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, DollarSign, Loader2, ShoppingCart, TrendingUp, Users } from "lucide-react";
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

type SalesReport = {
  summary: {
    totalRevenue: number;
    taxableRevenue: number;
    totalTax: number;
    totalDiscount: number;
    totalPaid: number;
    totalDue: number;
    totalOrders: number;
    averageOrderValue: number;
    activeCustomers: number;
    walkInOrders: number;
    cogs: number;
    grossProfit: number;
  };
  dailyData: { date: string; revenue: number; orders: number }[];
  topCustomers: {
    id: string;
    name: string;
    revenue: number;
    paid: number;
    due: number;
    orders: number;
  }[];
  topProducts: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
    tax: number;
  }[];
  statusData: { status: string; orders: number; amount: number }[];
  recentSales: {
    id: string;
    invoiceNumber: string;
    date: string;
    customer: string;
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

export function SalesReportsClient() {
  const { addToast } = useToast();
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [status, setStatus] = useState("POSTED");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (status) params.set("status", status);
      const res = await fetch(`/api/reports/sales?${params.toString()}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load sales report");
      }
      setReport(payload.data);
    } catch (error) {
      addToast({
        title: "Sales report failed",
        description: error instanceof Error ? error.message : "Unable to generate sales report",
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
        label: "Total revenue",
        value: formatCurrency(summary?.totalRevenue || 0),
        detail: `${summary?.totalOrders || 0} orders`,
        icon: DollarSign,
      },
      {
        label: "Average order",
        value: formatCurrency(summary?.averageOrderValue || 0),
        detail: "Selected period",
        icon: TrendingUp,
      },
      {
        label: "Paid / due",
        value: formatCurrency(summary?.totalPaid || 0),
        detail: `${formatCurrency(summary?.totalDue || 0)} due`,
        icon: ShoppingCart,
      },
      {
        label: "Customers",
        value: String(summary?.activeCustomers || 0),
        detail: `${summary?.walkInOrders || 0} walk-in orders`,
        icon: Users,
      },
    ];
  }, [report]);

  function exportReport() {
    if (!report) return;
    exportToCSV(
      report.recentSales,
      [
        { key: "date", label: "Date" },
        { key: "invoiceNumber", label: "Invoice" },
        { key: "customer", label: "Customer" },
        { key: "status", label: "Status" },
        { key: "paymentStatus", label: "Payment Status" },
        { key: "total", label: "Total" },
        { key: "paid", label: "Paid" },
        { key: "due", label: "Due" },
      ],
      `sales-report-${Date.now()}`,
    );
    addToast({ title: "Sales report exported", variant: "success" });
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
                <option value="POSTED">Posted invoices</option>
                <option value="ALL">All sales documents</option>
                <option value="COMPLETED">Completed</option>
                <option value="CONFIRMED">Sales orders</option>
                <option value="PROFORMA">Proforma</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" className="w-full" onClick={fetchReport} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sales report...
          </CardContent>
        </Card>
      ) : !report ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No sales report data could be loaded.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">Revenue trend</CardTitle>
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
                      dataKey="revenue"
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
            <ReportTable title="Top customers">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No customer sales in this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.topCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="text-right">{customer.orders}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(customer.revenue)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(customer.due)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ReportTable>

            <ReportTable title="Top products">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
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
                        No product sales in this period
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
                          {formatCurrency(product.revenue)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(product.tax)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ReportTable>
          </div>

          <ReportTable title="Recent sales">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.recentSales.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No sales found for the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  report.recentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(sale.date)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{sale.invoiceNumber}</TableCell>
                      <TableCell className="font-medium">{sale.customer}</TableCell>
                      <TableCell>
                        <Badge variant={sale.status === "COMPLETED" ? "success" : "secondary"}>
                          {sale.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sale.total)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(sale.due)}</TableCell>
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
