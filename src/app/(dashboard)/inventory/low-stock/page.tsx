import { requireCompanyAuth } from "@/lib/auth-helper";
import { getLowStockProducts } from "@/actions/inventory";
import { LowStockClient } from "@/features/inventory/low-stock-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function LowStockPage() {
  await requireCompanyAuth();
  const products = await getLowStockProducts().catch(() => []);
  return (
    <div className="space-y-6">
      <PageHeader title="Low Stock Alerts" description="Products below minimum stock threshold" />
      <LowStockClient products={products as any} />
    </div>
  );
}
