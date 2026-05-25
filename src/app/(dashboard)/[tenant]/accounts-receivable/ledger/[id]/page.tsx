import { requireCompanyAuth } from "@/lib/auth-helper";
import { getCustomerLedger } from "@/actions/accounting";
import { CustomerLedgerClient } from "@/features/accounting/customer-ledger-client";

export default async function TenantCustomerLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCompanyAuth();
  const data = await getCustomerLedger(id, { page: 1, pageSize: 30 }).catch(() => ({
    entries: [], customer: { id, name: "Unknown" }, summary: { totalDebit: 0, totalCredit: 0, balance: 0 },
  }));

  return <CustomerLedgerClient customerId={id} initialData={data} />;
}
