import { getAdminDashboard } from "@/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Users, ShoppingCart, CreditCard, Clock, AlertTriangle, DollarSign, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboard();
  const platformMoney = (amount: number) => formatCurrency(amount, "PKR", "Rs");

  const kpis = [
    { label: "Total Companies", value: data.totalCompanies, icon: Building, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Active Users", value: data.totalUsers, icon: Users, color: "text-green-600", bg: "bg-green-100" },
    { label: "Total Sales", value: platformMoney(data.totalSales), icon: ShoppingCart, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "Active Subscriptions", value: data.activeSubscriptions, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Expired", value: data.expiredSubscriptions, icon: Clock, color: "text-orange-600", bg: "bg-orange-100" },
    { label: "Pending Payments", value: data.pendingPayments, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100" },
    { label: "Total Revenue", value: platformMoney(data.totalRevenue), icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and key metrics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${kpi.bg}`}>
                    <Icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {data.plans.map((plan: any) => {
              const features = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features;
              return (
                <Card key={plan.id} className={`border-2 ${plan.isActive ? "border-primary/20" : "border-muted"} ${!plan.isActive && "opacity-60"}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      {!plan.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                    <div className="space-y-1 mb-4">
                      <p className="text-2xl font-bold">{platformMoney(Number(plan.monthlyPrice))}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <p className="text-sm text-muted-foreground">{platformMoney(Number(plan.yearlyPrice))}/year</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground"><Users className="inline h-3 w-3 mr-1" />{plan.userLimit} users</p>
                      <p className="text-xs text-muted-foreground">{plan.storageLimitMB} MB storage</p>
                    </div>
                    <ul className="mt-3 space-y-1">
                      {features.map((f: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-primary" />
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
