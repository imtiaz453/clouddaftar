import { getSales, getCustomers } from "@/actions/sales";
import { getProducts } from "@/actions/inventory";
import { getCompanySettings } from "@/actions/settings";
import { SalesClient } from "./sales-client";
import { serialize, serializeWithNumbers } from "@/lib/serialize";
import type { ProductOption } from "@/components/shared/line-item-editor";

export async function SalesPage() {
  try {
    const [sales, products, customers, company] = await Promise.all([
      getSales({ pageSize: 50 }),
      getProducts({ pageSize: 9999 }),
      getCustomers(),
      getCompanySettings(),
    ]);

    const defaultTaxRate = Number(company?.settings?.defaultTaxRate ?? company?.taxRate ?? 0);

    return <SalesClient sales={serialize(sales)} products={serializeWithNumbers(products.data) as unknown as ProductOption[]} customers={serialize(customers)} defaultTaxRate={defaultTaxRate} />;
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load</p>
      </div>
    );
  }
}
