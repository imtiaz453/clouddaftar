import { getSales } from "@/actions/sales";
import { SalesReturnsClient } from "./sales-returns-client";
import { serialize } from "@/lib/serialize";

export async function SalesReturnsPage() {
  try {
    const sales = await getSales({ pageSize: 100 });
    const returns = {
      ...sales,
      data: sales.data.filter(
        (s) => s.status === "REFUNDED" || s.status === "PARTIALLY_REFUNDED" || s.status === "CANCELLED",
      ),
    };
    return <SalesReturnsClient sales={serialize(returns)} />;
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load</p>
      </div>
    );
  }
}
