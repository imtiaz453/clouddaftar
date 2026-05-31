import { getStockCounts } from "@/actions/inventory";
import { StockCountsClient } from "@/features/inventory/stock-counts/stock-counts-client";
import { ServerLoadError } from "@/components/shared/server-load-error";

export const dynamic = "force-dynamic";

export default async function StockCountsPage() {
  let initialData: any = null;
  try {
    initialData = await getStockCounts({ page: 1, pageSize: 20 });
  } catch (error) {
    console.error("StockCountsPage load error:", error);
    return (
      <ServerLoadError
        title="Failed to load stock counts"
        message={error instanceof Error ? error.message : "Unable to load inventory data."}
      />
    );
  }
  return <StockCountsClient initialData={initialData} />;
}
