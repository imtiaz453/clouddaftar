import { getProducts, getCategories, getInventoryDashboardData } from "@/actions/inventory";
import { DashboardClient } from "@/features/inventory/dashboard-client";

export default async function TenantInventory() {
  let dashboardData: any = null;
  let categories: any[] = [];
  let error = false;
  try {
    [dashboardData, categories] = await Promise.all([
      getInventoryDashboardData(),
      getCategories(),
    ]);
  } catch {
    error = true;
  }

  return (
    <DashboardClient
      dashboardData={dashboardData}
      categories={categories}
      error={error}
    />
  );
}

export const dynamic = "force-dynamic";
