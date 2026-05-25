"use client";

import { useState, useCallback } from "react";
import { Wallet, AlertTriangle, Clock, ArrowDownCircle, TrendingUp, Users, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface AgingBucketItem {
  name: string;
  amount: number;
  color: string;
}

interface OverdueCustomer {
  id: string;
  name: string;
  totalDue: number;
  overdueDays: number;
}

interface DashboardData {
  totalReceivables: number;
  overdueReceivables: number;
  partiallyPaidInvoices: number;
  todayCollections: number;
  monthlyCollections: number;
  overdueCustomersCount: number;
  agingBuckets: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days90plus: number;
  };
  monthlyCollectionTrend: { month: string; amount: number }[];
  outstandingTrend: { date: string; amount: number }[];
  topOverdueCustomers: OverdueCustomer[];
}

interface ReceivableDashboardClientProps {
  dashboardData: DashboardData;
  onViewDetail?: (customerId: string) => void;
}

export function ReceivableDashboardClient({ dashboardData, onViewDetail }: ReceivableDashboardClientProps) {
  const d = dashboardData;

  const kpis = [
    {
      title: "Total Receivables",
      value: formatCurrency(d.totalReceivables),
      icon: Wallet,
      accent: "blue",
      bgClass: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
      iconBgClass: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
    },
    {
      title: "Overdue Receivables",
      value: formatCurrency(d.overdueReceivables),
      icon: AlertTriangle,
      accent: "red",
      bgClass: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
      iconBgClass: "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400",
    },
    {
      title: "Partially Paid",
      value: d.partiallyPaidInvoices.toString(),
      icon: Clock,
      accent: "amber",
      bgClass: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
      iconBgClass: "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400",
    },
    {
      title: "Today's Collections",
      value: formatCurrency(d.todayCollections),
      icon: ArrowDownCircle,
      accent: "green",
      bgClass: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
      iconBgClass: "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400",
    },
    {
      title: "Monthly Collections",
      value: formatCurrency(d.monthlyCollections),
      icon: TrendingUp,
      accent: "emerald",
      bgClass: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800",
      iconBgClass: "bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Overdue Customers",
      value: d.overdueCustomersCount.toString(),
      icon: Users,
      accent: "orange",
      bgClass: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
      iconBgClass: "bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400",
    },
  ];

  const agingChartData: AgingBucketItem[] = [
    { name: "Current", amount: d.agingBuckets.current, color: "#22c55e" },
    { name: "1-30 Days", amount: d.agingBuckets.days1to30, color: "#f59e0b" },
    { name: "31-60 Days", amount: d.agingBuckets.days31to60, color: "#f97316" },
    { name: "61-90 Days", amount: d.agingBuckets.days61to90, color: "#ef4444" },
    { name: "90+ Days", amount: d.agingBuckets.days90plus, color: "#dc2626" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts Receivable"
        description="Track and manage customer payments and outstanding invoices"
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title} className={kpi.bgClass}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
                  {kpi.title}
                </CardTitle>
                <div className={`rounded-lg p-1.5 sm:p-2 ${kpi.iconBgClass}`}>
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-base font-bold sm:text-xl xl:text-2xl">{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aging Analysis</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingChartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-xs text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-xs text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {agingChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Collections</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={d.monthlyCollectionTrend}
                  margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-xs text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-xs text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: "#22c55e", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {d.topOverdueCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Overdue Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount Due</TableHead>
                  <TableHead className="text-right">Overdue Days</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.topOverdueCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      {formatCurrency(customer.totalDue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive" className="text-xs">
                        {customer.overdueDays} days
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onViewDetail?.(customer.id)}
                        title="View details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
