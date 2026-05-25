import { requireCompanyAuth } from "@/lib/auth-helper";
import { getSupplierAging } from "@/actions/accounting";
import { SupplierAgingClient } from "@/features/accounting/supplier-aging-client";
import { PageHeader } from "@/components/shared/page-header";
import { serialize } from "@/lib/serialize";

export default async function TenantSupplierAgingPage() {
  await requireCompanyAuth();
  const result = await getSupplierAging({ page: 1, pageSize: 50 }).catch(() => null);
  const data = result ? result : {
    agingData: [] as any[], total: 0, pageSize: 50,
    summary: { totalCurrent: 0, total1to30: 0, total31to60: 0, total61to90: 0, total90plus: 0, totalOverdue: 0 },
    totalPages: 0, page: 1,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Supplier Aging Analysis" description="Age-wise breakdown of supplier payables" />
      <SupplierAgingClient initialData={serialize(data) as any} />
    </div>
  );
}
