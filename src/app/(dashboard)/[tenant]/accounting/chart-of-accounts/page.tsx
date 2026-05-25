import { getAccounts } from "@/actions/accounting-coa";
import { ChartOfAccountsClient } from "@/features/accounting/chart-of-accounts-client";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
  const accounts = await getAccounts();
  return <ChartOfAccountsClient initialAccounts={JSON.parse(JSON.stringify(accounts))} />;
}
