import { getStockAdjustments } from "@/actions/inventory";
import { AdjustmentsClient } from "@/features/inventory/adjustments/adjustments-client";

export const dynamic = "force-dynamic";

export default async function AdjustmentsPage() {
  let initialData: any = null;
  try {
    initialData = await getStockAdjustments({ page: 1, pageSize: 20 });
  } catch {
    // handled by client
  }

  return <AdjustmentsClient initialData={initialData} />;
}
