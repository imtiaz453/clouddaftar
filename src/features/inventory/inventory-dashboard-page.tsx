import { getInventoryDashboardData } from "@/actions/inventory-new";
import { InventoryDashboardClient } from "./inventory-dashboard-client";

export default async function InventoryDashboardPage() {
  const data = await getInventoryDashboardData();

  const serializedData = {
    ...data,
    recentMovements: data.recentMovements.map((movement) => ({
      ...movement,
      createdAt:
        movement.createdAt instanceof Date
          ? movement.createdAt.toISOString()
          : movement.createdAt,
      movementType: String(movement.movementType),
    })),
  };

  return <InventoryDashboardClient initialData={serializedData} />;
}