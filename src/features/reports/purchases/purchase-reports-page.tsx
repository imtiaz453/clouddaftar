import { PurchaseReportsClient } from "./purchase-reports-client";

export function PurchaseReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Purchase Reports</h1>
        <p className="text-sm text-muted-foreground">
          Track purchasing activity, supplier performance, and spend analysis
        </p>
      </div>
      <PurchaseReportsClient />
    </div>
  );
}
