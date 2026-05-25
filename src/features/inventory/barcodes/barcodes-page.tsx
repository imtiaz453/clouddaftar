import { getProducts } from "@/actions/inventory";
import {
  getWarehouseLocations,
  getWarehouseOperationsDashboard,
  getWarehouses,
} from "@/actions/locations";
import { BarcodesClient } from "./barcodes-client";
import { serialize } from "@/lib/serialize";

export async function BarcodesPage() {
  try {
    const [products, warehouses, locations, dashboard] = await Promise.all([
      getProducts({ pageSize: 9999 }),
      getWarehouses(),
      getWarehouseLocations(),
      getWarehouseOperationsDashboard({ includeWarehouses: false }),
    ]);

    return (
      <BarcodesClient
        products={serialize(products.data)}
        warehouses={serialize(warehouses)}
        locations={serialize(locations)}
        dashboard={serialize(dashboard)}
      />
    );
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load</p>
      </div>
    );
  }
}
