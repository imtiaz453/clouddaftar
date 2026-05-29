import { getStockCounts } from "@/actions/inventory-new";
import { CountsListClient } from "./counts-list-client";

export default async function CountsPage() {
  const data = await getStockCounts();
  return <CountsListClient initialData={data as unknown as any} />;
}
