"use client";

import { useRouter } from "next/navigation";
import {
  Package, PackageOpen, TrendingUp, AlertTriangle, AlertCircle,
  Truck, Clock, DollarSign, UserCircle, MapPin, ArrowRight,
  Plus, List, ArrowUpDown, ClipboardList, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, href, color }: {
  icon: LucideIcon; label: string; value: string | number; sub?: string; href?: string; color?: string;
}) {
  const router = useRouter();
  const colorClass = color || "text-primary";
  return (
    <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => href && router.push(href)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-lg bg-primary/10 p-2.5 ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" className="h-auto w-full justify-start gap-2 px-3 py-2" onClick={() => router.push(href)}>
      <Icon className="h-4 w-4" />
      <span className="text-xs">{label}</span>
    </Button>
  );
}

export function DashboardClient({ dashboardData, categories, error }: {
  dashboardData: any; categories: any[]; error: boolean;
}) {
  const router = useRouter();

  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center p-4">
        <EmptyState icon={AlertCircle} title="Could not load dashboard" description="There was an error loading inventory data." />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 sm:p-6"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-8 w-1/2" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const { d } = dashboardData;
  const data = d || dashboardData;

  const statCards = [
    { icon: Package, label: "Total Products", value: data.totalProducts || 0, sub: `${data.totalSkuWithStock || 0} with stock`, href: "/inventory/products" },
    { icon: MapPin, label: "Stock Locations", value: data.totalLocations || 0, href: "/inventory/locations" },
    { icon: PackageOpen, label: "Total Stock Qty", value: data.totalStockQty || 0, href: "/inventory/ledger" },
    { icon: DollarSign, label: "Stock Value", value: `$${((data.totalStockValue || 0)).toLocaleString()}`, color: "text-emerald-600" },
    { icon: AlertTriangle, label: "Low Stock", value: data.lowStockCount || 0, sub: "items below min", color: "text-amber-600", href: "/inventory/replenishment" },
    { icon: AlertCircle, label: "Out of Stock", value: data.outOfStockCount || 0, color: "text-red-600", href: "/inventory/replenishment" },
    { icon: Truck, label: "Pending Transfers", value: data.pendingTransferCount || 0, href: "/inventory/transfers" },
    { icon: DollarSign, label: "Damaged Stock", value: `$${((data.damagedStockValue || 0)).toLocaleString()}`, color: "text-red-600" },
    { icon: UserCircle, label: "Employee Custody", value: `$${((data.employeeCustodyValue || 0)).toLocaleString()}`, color: "text-blue-600" },
  ];

  const quickActions = [
    { icon: Plus, label: "Add Product", href: "/inventory/products/new" },
    { icon: MapPin, label: "Create Location", href: "/inventory/locations/new" },
    { icon: FileText, label: "Opening Balance", href: "/inventory/adjustments/new?reason=OPENING_BALANCE" },
    { icon: ArrowUpDown, label: "Transfer Stock", href: "/inventory/transfers/new" },
    { icon: ClipboardList, label: "Stock Adjustment", href: "/inventory/adjustments/new" },
    { icon: List, label: "Stock Count", href: "/inventory/stock-counts/new" },
    { icon: FileText, label: "View Ledger", href: "/inventory/ledger" },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Inventory Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time stock overview across all locations</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Stock by Location</CardTitle>
          </CardHeader>
          <CardContent>
            {data.stockByLocation?.length > 0 ? (
              <div className="space-y-3">
                {data.stockByLocation.map((loc: any) => (
                  <div key={loc.locationId} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{loc.locationName}</p>
                      <p className="text-xs text-muted-foreground">{loc.productCount} products</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{loc.totalQty?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">qty</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={MapPin} title="No stock locations" description="Create a location to start tracking stock." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {quickActions.map((action) => (
                <QuickAction key={action.label} {...action} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Movements</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => router.push("/inventory/ledger")}>
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentMovements?.length > 0 ? (
              <div className="space-y-2">
                {data.recentMovements.slice(0, 8).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.productName}</p>
                      <p className="text-xs text-muted-foreground">{m.locationName} · {formatDateTime(m.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={m.movementType?.includes("OUT") ? "destructive" : "success"} className="text-[10px]">
                        {m.movementType}
                      </Badge>
                      <p className="mt-0.5 text-xs text-muted-foreground">Qty: {m.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Truck} title="No movements yet" description="Movements appear when stock changes." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Low Stock Items</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => router.push("/inventory/replenishment")}>
              Replenish <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.lowStockItems?.length > 0 ? (
              <div className="space-y-2">
                {data.lowStockItems.slice(0, 8).map((item: any) => (
                  <div key={`${item.productId}-${item.locationName}`} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.locationName} · {item.sku}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="warning">{item.qtyOnHand} / {item.minStock}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={TrendingUp} title="Stock levels healthy" description="No low stock items found." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
