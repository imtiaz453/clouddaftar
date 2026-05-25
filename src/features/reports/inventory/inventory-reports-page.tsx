import { InventoryReportsClient } from "./inventory-reports-client";

export function InventoryReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory Reports</h1>
        <p className="text-sm text-muted-foreground">
          Monitor stock levels, turnover, and inventory valuation
        </p>
      </div>
      <InventoryReportsClient />
    </div>
  );
}
