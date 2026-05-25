import { requireCompanyAuth } from "@/lib/auth-helper";
import { getCustomerAging } from "@/actions/accounting";
import { CustomerAgingClient } from "@/features/accounts-receivable/customer-aging-client";
import { PageHeader } from "@/components/shared/page-header";
import { serialize } from "@/lib/serialize";

export default async function TenantCustomerAgingPage() {
  await requireCompanyAuth();
  const result = await getCustomerAging({ page: 1, pageSize: 50 }).catch(() => null);
  const data = result ? result : {
    agingData: [] as any[], total: 0, pageSize: 50,
    summary: { totalCurrent: 0, total1to30: 0, total31to60: 0, total61to90: 0, total90plus: 0, totalOverdue: 0 },
    totalPages: 0, page: 1,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Aging Analysis" description="Age-wise breakdown of customer receivables" />
      <CustomerAgingClient initialData={serialize(data) as any} />
    </div>
  );
}
