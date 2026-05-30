import { notFound } from "next/navigation";
import { getStockTransferDetail } from "@/actions/inventory-new";
import { TransferDetailClient } from "./transfer-detail-client";

export default async function TransferDetailPage({ params }: { params: { id: string } }) {
  try {
    const transfer = await getStockTransferDetail(params.id);

    if (!transfer) {
      notFound();
    }

    return <TransferDetailClient transfer={transfer as any} />;
  } catch (error) {
    console.error("TransferDetailPage failed to load transfer:", error);
    notFound();
  }
}
