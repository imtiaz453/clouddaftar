"use client";

import { Wallet, AlertTriangle, Clock, ArrowUpCircle, TrendingUp, Building2, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface AgingBucket {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
}

interface TopOverdueSupplier {
  id: string;
  name: string;
  totalDue: number;
  overdueDays: number;
}

interface PayableDashboardData {
  totalPayables: number;
  overduePayables: number;
  pendingPayments: number;
  todayPayouts: number;
  monthlyPayouts: number;
  overdueSuppliersCount: number;
  agingBuckets: AgingBucket;
  monthlyPaymentTrend: { month: string; amount: number }[];
  outstandingTrend: { date: string; amount: number }[];
  topOverdueSuppliers: TopOverdueSupplier[];
}

interface Props {
  dashboardData: PayableDashboardData;
}

const COLORS = {
  current: "#10b981",
  days1to30: "#f59e0b",
  days31to60: "#f97316",
  days61to90: "#ef4444",
  days90plus: "#991b1b",
};

export function PayableDashboardClient({ dashboardData }: Props) {
  const kpis = [
    { title: "Total Payables", value: formatCurrency(dashboardData.totalPayables), icon: Wallet, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30", trend: null, trendUp: null },
    { title: "Overdue Payables", value: formatCurrency(dashboardData.overduePayables), icon: AlertTriangle, color: "text-red-600 bg-red-100 dark:bg-red-900/30", trend: null, trendUp: null },
    { title: "Pending Payments", value: (dashboardData.pendingPayments ?? 0).toString(), icon: Clock, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30", trend: null, trendUp: null },
    { title: "Today's Payouts", value: formatCurrency(dashboardData.todayPayouts), icon: ArrowUpCircle, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30", trend: null, trendUp: null },
    { title: "Monthly Payouts", value: formatCurrency(dashboardData.monthlyPayouts), icon: TrendingUp, color: "text-green-600 bg-green-100 dark:bg-green-900/30", trend: null, trendUp: null },
    { title: "Overdue Suppliers", value: (dashboardData.overdueSuppliersCount ?? 0).toString(), icon: Building2, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30", trend: null, trendUp: null },
  ];

  const agingData = [
    { name: "Current", value: dashboardData.agingBuckets.current, fill: COLORS.current },
    { name: "1-30 Days", value: dashboardData.agingBuckets.days1to30, fill: COLORS.days1to30 },
    { name: "31-60 Days", value: dashboardData.agingBuckets.days31to60, fill: COLORS.days31to60 },
    { name: "61-90 Days", value: dashboardData.agingBuckets.days61to90, fill: COLORS.days61to90 },
    { name: "90+ Days", value: dashboardData.agingBuckets.days90plus, fill: COLORS.days90plus },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <div className={`rounded-lg p-1.5 ${kpi.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-base font-bold sm:text-xl">{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Payable Aging</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs text-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis className="text-xs text-muted-foreground" tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(Number(v))} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {agingData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Monthly Payments</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboardData.monthlyPaymentTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs text-muted-foreground" tickLine={false} axisLine={false} />
                <YAxis className="text-xs text-muted-foreground" tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(Number(v))} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {dashboardData.topOverdueSuppliers.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Top Overdue Suppliers</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {dashboardData.topOverdueSuppliers.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.overdueDays} days overdue</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-red-600">{formatCurrency(s.totalDue)}</span>
                    <Badge variant={s.overdueDays > 90 ? "destructive" : "warning"}>{s.overdueDays}d</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
