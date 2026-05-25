"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { exportToCSV } from "@/lib/export-utils";
import { formatCurrency, taxLabel } from "@/lib/utils";

export function TaxReportsClient() {
  const label = taxLabel();
  const metrics = [
    { label: `${label} Collected (Sales)`, value: formatCurrency(0), icon: TrendingUp },
    { label: `${label} Paid (Purchases)`, value: formatCurrency(0), icon: TrendingDown },
    { label: `Net ${label} Liability`, value: formatCurrency(0), icon: FileText },
    { label: `Avg ${label} Rate`, value: "0%", icon: Percent },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {label} reports will be available soon with detailed breakdowns by rate and period
        </p>
        <Button variant="outline" size="sm" onClick={() => exportToCSV([], [], "tax-report")} disabled>
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
