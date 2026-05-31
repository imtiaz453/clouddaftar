import { getStockAdjustments } from "@/actions/inventory";
import { AdjustmentsListClient } from "./adjustments-list-client";

export default async function AdjustmentsPage() {
  const data = await getStockAdjustments();
  return <AdjustmentsListClient initialData={data as unknown as any} />;
}
