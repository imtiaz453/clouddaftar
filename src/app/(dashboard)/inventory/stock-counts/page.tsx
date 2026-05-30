import { getStockCounts } from "@/actions/inventory";
import { StockCountsClient } from "@/features/inventory/stock-counts/stock-counts-client";

export const dynamic = "force-dynamic";

export default async function StockCountsPage() {
  let initialData: any = null;
  try {
    initialData = await getStockCounts({ page: 1, pageSize: 20 });
  } catch {}
  return <StockCountsClient initialData={initialData} />;
}
