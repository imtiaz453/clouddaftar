import { SalesReportsClient } from "./sales-reports-client";

export function SalesReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sales Reports</h1>
        <p className="text-sm text-muted-foreground">
          Analyze sales performance, trends, and revenue
        </p>
      </div>
      <SalesReportsClient />
    </div>
  );
}
