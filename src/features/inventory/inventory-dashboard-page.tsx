import { getInventoryDashboardData } from "@/actions/inventory-new";
import { InventoryDashboardClient } from "./inventory-dashboard-client";

export default async function InventoryDashboardPage() {
  const data = await getInventoryDashboardData();
  return <InventoryDashboardClient initialData={data} />;
}
