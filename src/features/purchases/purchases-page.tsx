import { getPurchases, getSuppliers } from "@/actions/purchases";
import { getProducts } from "@/actions/inventory";
import { PurchasesClient } from "./purchases-client";
import { serialize } from "@/lib/serialize";

export async function PurchasesPage() {
  try {
    const [purchases, products, suppliers] = await Promise.all([
      getPurchases({ pageSize: 50 }),
      getProducts({ pageSize: 9999 }),
      getSuppliers(),
    ]);

    return (
      <PurchasesClient
        purchases={serialize(purchases)}
        products={serialize(products.data)}
        suppliers={serialize(suppliers)}
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
