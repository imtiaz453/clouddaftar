import { getStockTransfers } from "@/actions/inventory";
import { TransfersClient } from "@/features/inventory/transfers/transfers-client";
import { ServerLoadError } from "@/components/shared/server-load-error";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  let initialData: any = null;
  try {
    initialData = await getStockTransfers({ page: 1, pageSize: 20 });
  } catch (error) {
    console.error("TransfersPage load error:", error);
    return (
      <ServerLoadError
        title="Failed to load stock transfers"
        message={error instanceof Error ? error.message : "Unable to load inventory data."}
      />
    );
  }
  return <TransfersClient initialData={initialData} />;
}
