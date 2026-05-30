import { getStockTransfers } from "@/actions/inventory";
import { TransfersClient } from "@/features/inventory/transfers/transfers-client";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  let initialData: any = null;
  try {
    initialData = await getStockTransfers({ page: 1, pageSize: 20 });
  } catch {}
  return <TransfersClient initialData={initialData} />;
}
