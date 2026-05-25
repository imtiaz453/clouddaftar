"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Package, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { exportToCSV } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/utils";

export function InventoryReportsClient() {
  const metrics = [
    { label: "Total Products", value: "0", icon: Package },
    { label: "Low Stock Items", value: "0", icon: AlertTriangle },
    { label: "Stock Value", value: formatCurrency(0), icon: DollarSign },
    { label: "Turnover Rate", value: "0%", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Inventory reports and analytics will be available soon with charts and export options
        </p>
        <Button variant="outline" size="sm" onClick={() => exportToCSV([], [], "inventory-report")} disabled>
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
          </Card>
        ))}
      </div>
    </div>
  );
}
