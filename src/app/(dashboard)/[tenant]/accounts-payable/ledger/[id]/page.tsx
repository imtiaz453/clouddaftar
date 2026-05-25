import { requireCompanyAuth } from "@/lib/auth-helper";
import { getSupplierLedger } from "@/actions/accounting";
import { SupplierLedgerClient } from "@/features/accounting/supplier-ledger-client";

export default async function TenantSupplierLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCompanyAuth();
  const data = await getSupplierLedger(id, { page: 1, pageSize: 30 }).catch(() => ({
    entries: [], supplier: { id, name: "Unknown" }, summary: { totalDebit: 0, totalCredit: 0, balance: 0 },
  }));

  return <SupplierLedgerClient supplierId={id} initialData={data} />;
}
