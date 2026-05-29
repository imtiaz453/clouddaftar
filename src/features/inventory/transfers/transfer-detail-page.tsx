import { getStockTransferDetail } from "@/actions/inventory-new";
import { TransferDetailClient } from "./transfer-detail-client";

export default async function TransferDetailPage({ params }: { params: { id: string } }) {
  const transfer = await getStockTransferDetail(params.id);
  return <TransferDetailClient transfer={transfer as any} />;
}
