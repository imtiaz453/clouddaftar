import { requireCompanyAuth } from "@/lib/auth-helper";
import { AccountingReportsClient } from "@/features/accounting/accounting-reports-client";

export default async function TenantAccountingReportsPage() {
  await requireCompanyAuth();
  return <AccountingReportsClient />;
}
