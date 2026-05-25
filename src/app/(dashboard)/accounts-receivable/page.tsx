import { requireCompanyAuth } from "@/lib/auth-helper";
import { prisma } from "@/lib/prisma";
import { getReceivableDashboard, getReceivables } from "@/actions/accounting";
import { ReceivableDashboardClient } from "@/features/accounts-receivable/receivable-dashboard-client";
import { ReceivableTableClient } from "@/features/accounts-receivable/receivable-table-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function AccountsReceivablePage() {
  const { companyId } = await requireCompanyAuth();
  const [dashboardData, receivablesData, customers] = await Promise.all([
    getReceivableDashboard().catch(() => null),
    getReceivables({ page: 1, pageSize: 20 }).catch(() => ({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 })),
    prisma.customer.findMany({ where: { companyId, isActive: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts Receivable" description="Manage customer receivables, collections, and aging" />
      {dashboardData && <ReceivableDashboardClient dashboardData={dashboardData} />}
      <ReceivableTableClient initialData={receivablesData} customers={customers} />
    </div>
  );
}
