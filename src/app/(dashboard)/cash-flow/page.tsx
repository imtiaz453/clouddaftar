import { requireCompanyAuth } from "@/lib/auth-helper";
import { getCashFlow } from "@/actions/accounting";
import { CashFlowClient } from "@/features/accounting/cash-flow-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function CashFlowPage() {
  await requireCompanyAuth();
  const data = await getCashFlow({ page: 1, pageSize: 50 }).catch(() => ({
    data: [], summary: { totalInflow: 0, totalOutflow: 0, netCashFlow: 0 },
    total: 0, page: 1, pageSize: 50, totalPages: 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Cash Flow" description="Track cash inflows and outflows" />
      <CashFlowClient initialData={data as any} />
    </div>
  );
}
