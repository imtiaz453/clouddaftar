import { getStockTransfers } from "@/actions/inventory-new";
import { TransfersListClient } from "./transfers-list-client";

export default async function TransfersPage() {
  const data = await getStockTransfers();
  return <TransfersListClient initialData={data as any} />;
}
