import { requireCompanyAuth } from "@/lib/auth-helper";
import { prisma } from "@/lib/prisma";
import { getReconciliations } from "@/actions/accounting";
import { ReconciliationClient } from "@/features/accounting/reconciliation-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function ReconciliationPage() {
  const { companyId } = await requireCompanyAuth();
  const [reconData, customers, suppliers] = await Promise.all([
    getReconciliations({ page: 1, pageSize: 50 }).catch(() => ({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 })),
    prisma.customer.findMany({ where: { companyId, isActive: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { companyId, isActive: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <ReconciliationClient initialData={reconData} customers={customers} suppliers={suppliers} />
    </div>
  );
}
