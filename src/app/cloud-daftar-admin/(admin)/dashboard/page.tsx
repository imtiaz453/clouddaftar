import Link from "next/link";
import { getAdminDashboard } from "@/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building,
  CreditCard,
  DollarSign,
  FileText,
  Gauge,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
  Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboard();
  const platformMoney = (amount: number) => formatCurrency(amount, "PKR", "Rs");

  const kpis = [
    { label: "Companies", value: data.totalCompanies, hint: "registered tenants", icon: Building, accent: "from-sky-500 to-cyan-400" },
    { label: "Users", value: data.totalUsers, hint: "platform accounts", icon: Users, accent: "from-emerald-500 to-teal-400" },
    { label: "Sales", value: platformMoney(data.totalSales), hint: "tenant turnover", icon: ShoppingCart, accent: "from-violet-500 to-fuchsia-500" },
    { label: "Active Plans", value: data.activeSubscriptions, hint: "paid subscriptions", icon: Activity, accent: "from-green-500 to-emerald-400" },
    { label: "Expired", value: data.expiredSubscriptions, hint: "need follow-up", icon: Clock, accent: "from-orange-500 to-amber-400" },
    { label: "Pending Payments", value: data.pendingPayments, hint: "awaiting verification", icon: AlertTriangle, accent: "from-rose-500 to-red-400" },
    { label: "Revenue", value: platformMoney(data.totalRevenue), hint: "verified platform income", icon: DollarSign, accent: "from-indigo-500 to-blue-500" },
  ];

  const commandCenter = [
    { title: "Verify payments", text: "Review pending deposits and activate subscriptions.", href: "/cloud-daftar-admin/payments", icon: CreditCard, badge: data.pendingPayments },
    { title: "Manage tenants", text: "Open company records, plans, users and status controls.", href: "/cloud-daftar-admin/tenants", icon: Building },
    { title: "Subscription plans", text: "Tune packages, limits, features and pricing.", href: "/cloud-daftar-admin/plans", icon: FileText },
    { title: "Branding & controls", text: "Update app identity, AI settings and platform defaults.", href: "/cloud-daftar-admin/settings", icon: Settings },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-cyan-500/10 p-6 shadow-lg md:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-4">
            <Badge className="w-fit border-primary/20 bg-primary/10 text-primary hover:bg-primary/15">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Cloud Daftar Control Tower
            </Badge>
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">Super Admin Dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Command center for tenant control, payment approvals, subscriptions, audit visibility and platform growth.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[420px]">
            <div className="rounded-2xl border border-primary/15 bg-background/75 p-4 backdrop-blur">
              <p className="text-xs text-muted-foreground">Health</p>
              <p className="mt-1 text-2xl font-black">Live</p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-background/75 p-4 backdrop-blur">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="mt-1 truncate text-xl font-black">{platformMoney(data.totalRevenue)}</p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-background/75 p-4 backdrop-blur">
              <p className="text-xs text-muted-foreground">Alerts</p>
              <p className="mt-1 text-2xl font-black">{data.pendingPayments + data.expiredSubscriptions}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="group overflow-hidden border-0 bg-white shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/70 transition-all hover:-translate-y-0.5 hover:shadow-xl">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-muted-foreground">{kpi.label}</p>
                    <p className="mt-2 truncate text-2xl font-black tracking-tight">{kpi.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
                  </div>
                  <div className={`rounded-2xl bg-gradient-to-br ${kpi.accent} p-3 text-white shadow-lg shadow-slate-950/10`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden border-0 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-black">
                  <Gauge className="h-5 w-5 text-primary" /> Command & Control
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Quick operational actions for the platform owner.</p>
              </div>
              <Badge variant="secondary" className="hidden sm:inline-flex">Admin tools</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            {commandCenter.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    {item.badge != null && item.badge > 0 ? <Badge className="bg-amber-500 text-white">{item.badge}</Badge> : null}
                  </div>
                  <h3 className="mt-4 font-black tracking-tight">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm font-bold text-primary">
                    Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <ShieldCheck className="h-5 w-5 text-primary" /> Platform checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Verify pending payments before activating accounts",
              "Review expired subscriptions and contact tenants",
              "Keep audit log enabled for sensitive admin actions",
              "Review plan limits before creating promotional packages",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border bg-slate-50 p-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">✓</span>
                <span className="text-slate-700">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden border-0 shadow-xl shadow-slate-950/5 ring-1 ring-slate-200/70">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="text-xl font-black">Subscription Plans</CardTitle>
          <p className="text-sm text-muted-foreground">Commercial packages currently available on the platform.</p>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.plans.map((plan: any) => {
              const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features;
              return (
                <Card key={plan.id} className={`border-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${plan.isActive ? "border-primary/25" : "border-muted opacity-60"}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-black tracking-tight">{plan.name}</h3>
                      {plan.isActive ? <Badge className="bg-emerald-600">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{plan.description}</p>
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <p className="text-2xl font-black">
                        {platformMoney(Number(plan.monthlyPrice))}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{platformMoney(Number(plan.yearlyPrice))}/year</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="rounded-xl bg-secondary px-3 py-2"><Users className="mr-1 inline h-3 w-3" />{plan.userLimit} users</span>
                      <span className="rounded-xl bg-secondary px-3 py-2">{plan.storageLimitMB} MB</span>
                    </div>
                    <ul className="mt-4 space-y-2">
                      {features.map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
