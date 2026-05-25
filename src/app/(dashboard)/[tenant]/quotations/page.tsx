import { requireCompanyAuth } from "@/lib/auth-helper";
import { getQuotations } from "@/actions/quotations";
import { getCompanySettings } from "@/actions/settings";
import { QuotationsClient } from "@/features/quotations/quotations-client";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { serializeWithNumbers } from "@/lib/serialize";

export default async function TenantQuotationsPage() {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const [data, customers, products, company] = await Promise.all([
    getQuotations({ page: 1, pageSize: 20 }).catch(() => ({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 })),
    prisma.customer.findMany({ where: { companyId, isActive: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.product.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unit: true,
        stock: true,
        isActive: true,
        isService: true,
        sellingPrice: true,
        purchasePrice: true,
        tax: true,
      },
      orderBy: { name: "asc" },
    }).catch(() => []),
    getCompanySettings(),
  ]);
  const defaultTaxRate = Number(company?.settings?.defaultTaxRate ?? company?.taxRate ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Quotations" description="Create and manage customer quotations" />
      <QuotationsClient initialData={data as any} customers={serializeWithNumbers(customers)} products={(serializeWithNumbers(products) || []) as any} defaultTaxRate={defaultTaxRate} />
    </div>
  );
}
