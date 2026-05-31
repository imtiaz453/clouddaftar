import { getStockTransferDetail } from "@/actions/inventory";
import { TransferDetailClient } from "@/features/inventory/transfers/transfer-detail-client";
import { ServerLoadError } from "@/components/shared/server-load-error";

export const dynamic = "force-dynamic";

export default async function TransferDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let transfer: any = null;
  try {
    transfer = await getStockTransferDetail(id);
  } catch (error) {
    console.error("TransferDetailPage load error:", error);
    return (
      <ServerLoadError
        title="Failed to load stock transfer"
        message={error instanceof Error ? error.message : "Unable to load inventory data."}
      />
    );
  }
  return <TransferDetailClient transfer={transfer} />;
}
