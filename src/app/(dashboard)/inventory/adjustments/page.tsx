import { requireCompanyAuth } from "@/lib/auth-helper";
import { getProducts } from "@/actions/inventory";
import { AdjustmentsClient } from "@/features/inventory/adjustments/adjustments-client";
import { PageHeader } from "@/components/shared/page-header";
import { serialize } from "@/lib/serialize";

export default async function StockAdjustmentsPage() {
  await requireCompanyAuth();
  const products = await getProducts({ pageSize: 9999 }).catch(() => ({ data: [], total: 0, page: 1, pageSize: 500, totalPages: 0 }));

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Adjustments" description="Adjust product stock levels manually" />
      <AdjustmentsClient products={serialize(products.data) as any} />
    </div>
  );
}
