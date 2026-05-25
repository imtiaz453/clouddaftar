import { TaxReportsClient } from "./tax-reports-client";

export function TaxReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tax / VAT Reports</h1>
        <p className="text-sm text-muted-foreground">
          View tax or VAT collected, paid, and calculate your liability
        </p>
      </div>
      <TaxReportsClient />
    </div>
  );
}
