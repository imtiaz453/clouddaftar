import { getPurchases } from "@/actions/purchases";
import { PurchaseReturnsClient } from "./purchase-returns-client";
import { serialize } from "@/lib/serialize";

export async function PurchaseReturnsPage() {
  try {
    const purchases = await getPurchases({ pageSize: 100, status: "CANCELLED" });
    return <PurchaseReturnsClient purchases={serialize(purchases)} />;
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load</p>
      </div>
    );
  }
}
