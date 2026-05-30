import { getReplenishmentData } from "@/actions/inventory";
import { ReplenishmentClient } from "@/features/inventory/replenishment/replenishment-client";

export const dynamic = "force-dynamic";

export default async function ReplenishmentPage() {
  let initialData: any = null;
  try {
    initialData = await getReplenishmentData();
  } catch {}
  return <ReplenishmentClient initialData={initialData} />;
}
