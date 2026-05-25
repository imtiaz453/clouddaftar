import { requireCompanyAuth } from "@/lib/auth-helper";
import { prisma } from "@/lib/prisma";
import { getPayableDashboard, getPayables } from "@/actions/accounting";
import { PayableDashboardClient } from "@/features/accounts-payable/payable-dashboard-client";
import { PayableTableClient } from "@/features/accounts-payable/payable-table-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function TenantAccountsPayablePage() {
  const { companyId } = await requireCompanyAuth();
  const [dashboardData, payablesData, suppliers] = await Promise.all([
    getPayableDashboard().catch(() => null),
    getPayables({ page: 1, pageSize: 20 }).catch(() => ({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 })),
    prisma.supplier.findMany({ where: { companyId, isActive: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts Payable" description="Manage supplier payables, payments, and aging" />
      {dashboardData && <PayableDashboardClient dashboardData={dashboardData as any} />}
      <PayableTableClient initialData={payablesData} suppliers={suppliers} />
    </div>
  );
}
