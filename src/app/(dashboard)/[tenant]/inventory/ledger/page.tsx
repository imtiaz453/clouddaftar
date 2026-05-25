import { requireCompanyAuth } from "@/lib/auth-helper";
import { getInventoryLedger } from "@/actions/inventory";
import { InventoryLedgerClient } from "@/features/inventory/inventory-ledger-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function TenantInventoryLedgerPage() {
  await requireCompanyAuth();
  const data = await getInventoryLedger({ page: 1, pageSize: 50 }).catch(() => ({
    data: [], total: 0, page: 1, pageSize: 50, totalPages: 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Ledger" description="All stock movements across products" />
      <InventoryLedgerClient initialData={data as any} />
    </div>
  );
}
