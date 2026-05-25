import { getAccounts } from "@/actions/accounting-coa";
import { JournalEntriesClient } from "@/features/accounting/journal-entries-client";

export const dynamic = "force-dynamic";

export default async function JournalEntriesPage() {
  const accounts = await getAccounts();
  return <JournalEntriesClient initialAccounts={JSON.parse(JSON.stringify(accounts))} />;
}
