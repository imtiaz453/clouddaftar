"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Receipt,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DashboardStats } from "@/types";
import { SalesChart } from "./sales-chart";

interface DashboardClientProps {
  stats: DashboardStats;
}

const dashboardRoutes = new Set([
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
  "/apps",
]);

function useTenantBasePath() {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0] ? `/${segments[0]}` : "";
  const isTenant = first && !dashboardRoutes.has(first);
  return isTenant ? first : "";
}

function href(base: string, tenant: string) {
  if (!tenant) return base === "/" ? "/" : base;
  return base === "/" ? tenant : `${tenant}${base}`;
}

function monthlySalesTrendLabel(stats: DashboardStats): {
  text: string;
  variant: "up" | "down" | "neutral";
} | null {
  const { monthlySalesChangePct, monthlySales, monthlySalesPriorPeriod } = stats;
  if (monthlySalesChangePct != null && Number.isFinite(monthlySalesChangePct)) {
    const text = `${monthlySalesChangePct >= 0 ? "+" : ""}${monthlySalesChangePct.toFixed(1)}%`;
    return { text, variant: monthlySalesChangePct >= 0 ? "up" : "down" };
  }
  if (monthlySalesPriorPeriod <= 0 && monthlySales > 0) {
    return { text: "No prior period to compare", variant: "neutral" };
  }
  return null;
}

export function DashboardClient({ stats }: DashboardClientProps) {
  const tenant = useTenantBasePath();
  const salesTrend = monthlySalesTrendLabel(stats);

  const kpis = [
    {
      title: "Total sales",
      description: "All completed invoices to date",
      value: formatCurrency(stats.totalSales),
      icon: DollarSign,
      trend: null as ReturnType<typeof monthlySalesTrendLabel>,
    },
    {
      title: "Month to date",
      description: "Same window vs last month",
      value: formatCurrency(stats.monthlySales),
      icon: ShoppingCart,
      trend: salesTrend,
    },
    {
      title: "Products",
      description: "Active SKUs",
      value: String(stats.totalProducts),
      icon: Package,
      trend: null as ReturnType<typeof monthlySalesTrendLabel>,
    },
    {
      title: "Customers",
      description: "Active accounts",
      value: String(stats.totalCustomers),
      icon: Users,
      trend: null as ReturnType<typeof monthlySalesTrendLabel>,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Sales velocity, stock risk, and recent activity in one place."
      >
        <Button variant="secondary" asChild className="shadow-sm">
          <Link href={href("/reports", tenant)} className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Reports
          </Link>
        </Button>
      </PageHeader>

      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Key metrics
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-semibold text-muted-foreground">{kpi.title}</CardTitle>
                    <CardDescription className="text-xs leading-snug">{kpi.description}</CardDescription>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
                  {kpi.trend && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      {kpi.trend.variant === "neutral" ? (
                        <span className="text-muted-foreground">{kpi.trend.text}</span>
                      ) : (
                        <>
                          {kpi.trend.variant === "up" ? (
                            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                          )}
                          <span
                            className={
                              kpi.trend.variant === "up"
                                ? "font-medium text-emerald-600 dark:text-emerald-400"
                                : "font-medium text-red-600 dark:text-red-400"
                            }
                          >
                            {kpi.trend.text}
                          </span>
                          <span className="text-muted-foreground">vs last month</span>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="trend-heading" className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-4">
              <div>
                <CardTitle id="trend-heading" className="text-lg">
                  Daily sales
                </CardTitle>
                <CardDescription>Last six months, grouped by calendar day (UTC)</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={href("/sales", tenant)} className="gap-1">
                  Sales
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-5">
              <SalesChart data={stats.salesTrend} />
            </CardContent>
          </Card>
        </div>

        <Card className="flex flex-col">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-lg">Purchases (MTD)</CardTitle>
            <CardDescription>Spend recorded this calendar month</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center pt-6">
            <p className="text-3xl font-bold tabular-nums">{formatCurrency(stats.monthlyPurchases)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Lifetime purchases: {formatCurrency(stats.totalPurchases)}
            </p>
            <Button variant="outline" className="mt-6 w-full" asChild>
              <Link href={href("/purchases", tenant)} className="gap-1">
                Open purchases
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <CardTitle className="text-lg">Recent sales</CardTitle>
              <CardDescription>Newest invoices (permission-scoped)</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-primary">
              <Link href={href("/sales", tenant)} className="gap-1">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {stats.recentSales.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 py-12 text-center">
                <Receipt className="h-10 w-10 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">No sales yet. Create one from Sales → New invoice.</p>
                <Button asChild size="sm">
                  <Link href={href("/sales/new", tenant)}>New sale</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {stats.recentSales.map((sale) => (
                  <li
                    key={sale.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight">{sale.invoiceNumber}</p>
                      <p className="truncate text-sm text-muted-foreground">{sale.customerName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(sale.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{formatCurrency(sale.total)}</span>
                      <Badge
                        variant={sale.status === "COMPLETED" ? "success" : "secondary"}
                        className="text-[10px] uppercase"
                      >
                        {sale.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <CardTitle className="text-lg">Stock alerts</CardTitle>
              <CardDescription>On-hand at or below minimum</CardDescription>
            </div>
            {stats.lowStockCount > 0 && (
              <Button variant="ghost" size="sm" asChild className="text-amber-700 dark:text-amber-400">
                <Link href={href("/inventory/low-stock", tenant)} className="gap-1">
                  Manage
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            {stats.lowStockCount === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 py-12 text-center">
                <Package className="h-10 w-10 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">All tracked products are above their minimum levels.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-amber-200/90 bg-amber-50/90 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                      {stats.lowStockCount} product{stats.lowStockCount === 1 ? "" : "s"} need attention
                    </p>
                    <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
                      Showing the lowest five by on-hand quantity.
                    </p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {stats.lowStockItems.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card/50 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {p.stock} / {p.minStock}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
