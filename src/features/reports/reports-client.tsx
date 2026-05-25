"use client";

import { Download, Users, Building2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { formatCurrency } from "@/lib/utils";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import type { DashboardStats } from "@/types";
import { SalesChart } from "@/features/dashboard/sales-chart";
import { ChartCurrencyTooltip } from "@/components/charts/chart-currency-tooltip";

interface ReportsClientProps {
  stats: DashboardStats;
}

const dashboardRoutes = [
  "/",
  "/inventory",
  "/sales",
  "/purchases",
  "/customers",
  "/suppliers",
  "/reports",
  "/settings",
  "/users",
  "/profile",
  "/audit-log",
  "/billing",
];

export function ReportsClient({ stats }: ReportsClientProps) {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const tenant =
    segments.length >= 2 && !dashboardRoutes.includes("/" + segments[0]) ? "/" + segments[0] : "";
  function href(path: string) {
    return tenant ? `${tenant}${path}` : path;
  }

  const summaryCards = [
    {
      title: "Total revenue",
      value: formatCurrency(stats.totalSales),
      label: "All-time sales",
    },
    {
      title: "Month to date",
      value: formatCurrency(stats.monthlySales),
      label: "This calendar month",
    },
    {
      title: "Total purchases",
      value: formatCurrency(stats.totalPurchases),
      label: "All-time buy-side",
    },
    {
      title: "Active products",
      value: String(stats.totalProducts),
      label: "In inventory",
    },
  ];

  const revenueVsPurchases = [
    { name: "Sales", amount: stats.totalSales, fill: "hsl(var(--primary))" },
    { name: "Purchases", amount: stats.totalPurchases, fill: "hsl(215 25% 48%)" },
  ];

  return (
    <PageShell>
      <PageHeader title="Reports" description="Cross-module metrics and quick entry points to statements.">
        <Button
          variant="secondary"
          className="shadow-sm"
          onClick={() => {
            const columns: ExportColumn[] = [
              { key: "metric", label: "Metric" },
              { key: "value", label: "Value" },
            ];
            const data = [
              { metric: "Total Revenue", value: formatCurrency(stats.totalSales) },
              { metric: "Monthly Revenue", value: formatCurrency(stats.monthlySales) },
              { metric: "Total Purchases", value: formatCurrency(stats.totalPurchases) },
              { metric: "Active Products", value: String(stats.totalProducts) },
              { metric: "Total Customers", value: String(stats.totalCustomers) },
            ];
            exportToCSV(data, columns, `report-export-${Date.now()}`);
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Export summary
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">{card.title}</CardTitle>
              <CardDescription className="text-xs">{card.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums tracking-tight">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-lg">Daily sales</CardTitle>
            <CardDescription>Same series as the dashboard (UTC days)</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <SalesChart data={stats.salesTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-lg">Lifetime sales vs purchases</CardTitle>
            <CardDescription>Aggregated totals, not period cash flow</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="h-[min(320px,50vh)] min-h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueVsPurchases} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/80" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={76}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                  />
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.35)" }} content={<ChartCurrencyTooltip />} />
                  <Bar dataKey="amount" name="Amount" radius={[8, 8, 0, 0]} maxBarSize={72} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <Link
          href={href("/reports/customer-statement")}
          className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Customer statement</p>
              <p className="text-sm text-muted-foreground">Per-customer activity</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
        <Link
          href={href("/reports/supplier-statement")}
          className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Supplier statement</p>
              <p className="text-sm text-muted-foreground">Per-supplier activity</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </PageShell>
  );
}
