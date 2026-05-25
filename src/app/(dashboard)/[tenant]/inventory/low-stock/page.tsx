import { requireCompanyAuth } from "@/lib/auth-helper";
import { getLowStockProducts } from "@/actions/inventory";
import { LowStockClient } from "@/features/inventory/low-stock-client";
import { PageHeader } from "@/components/shared/page-header";

function serializeProduct(p: any) {
  return {
    ...p,
    purchasePrice: Number(p.purchasePrice),
    sellingPrice: Number(p.sellingPrice),
    wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : null,
    tax: Number(p.tax),
    discount: Number(p.discount),
  };
}

export default async function TenantLowStockPage() {
  await requireCompanyAuth();
  const products = await getLowStockProducts().catch(() => []);
  return (
    <div className="space-y-6">
      <PageHeader title="Low Stock Alerts" description="Products below minimum stock threshold" />
      <LowStockClient products={products.map(serializeProduct)} />
    </div>
  );
}
