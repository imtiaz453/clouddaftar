"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { TrendingUp, DollarSign, ShoppingCart, Users, Download } from "lucide-react";
import { exportToCSV } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/utils";

export function SalesReportsClient() {
  const metrics = [
    { label: "Total Revenue", value: formatCurrency(0), icon: DollarSign, change: "+0%" },
    { label: "Total Orders", value: "0", icon: ShoppingCart, change: "0" },
    { label: "Avg Order Value", value: formatCurrency(0), icon: TrendingUp, change: "+0%" },
    { label: "Active Customers", value: "0", icon: Users, change: "0" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Sales reports and analytics will be available soon with charts and export options
        </p>
        <Button variant="outline" size="sm" onClick={() => exportToCSV([], [], "sales-report")} disabled>
          <Download className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{m.label}</p>
              <m.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.change} vs last period</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
