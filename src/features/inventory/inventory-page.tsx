import { getProducts, getCategories, getInventoryOperationsOverview } from "@/actions/inventory";
import { InventoryClient } from "./inventory-client";
import { serialize } from "@/lib/serialize";

export async function InventoryPage() {
  let products;
  let categories;
  let overview;

  try {
    [products, categories, overview] = await Promise.all([
      getProducts({ pageSize: 9999 }),
      getCategories(),
      getInventoryOperationsOverview(),
    ]);
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load</p>
      </div>
    );
  }

  return (
    <InventoryClient
      products={serialize(products)}
      categories={serialize(categories)}
      overview={serialize(overview)}
    />
  );
}
