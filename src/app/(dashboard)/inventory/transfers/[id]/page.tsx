import { getStockTransferDetail } from "@/actions/inventory";
import { TransferDetailClient } from "@/features/inventory/transfers/transfer-detail-client";

export const dynamic = "force-dynamic";

export default async function TransferDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let transfer: any = null;
  try {
    transfer = await getStockTransferDetail(id);
  } catch {}
  return <TransferDetailClient transfer={transfer} />;
}
