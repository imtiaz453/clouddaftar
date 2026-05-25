import { getAccounts } from "@/actions/accounting-coa";
import { FinancialReportsClient } from "@/features/accounting/financial-reports-client";

export const dynamic = "force-dynamic";

export default async function FinancialReportsPage() {
  const accounts = await getAccounts();
  return <FinancialReportsClient initialAccounts={JSON.parse(JSON.stringify(accounts))} />;
}
