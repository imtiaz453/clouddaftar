import { getProducts, getCategories } from "@/actions/inventory";
import { getCustomers } from "@/actions/sales";
import { getCompanySettings } from "@/actions/settings";
import { NewSaleClient } from "./new-sale-client";
import { serialize, serializeWithNumbers } from "@/lib/serialize";
import type { ProductOption } from "@/components/shared/line-item-editor";

interface CategoryOption {
  id: string;
  name: string;
  color?: string | null;
}

export async function NewSalePage() {
  try {
    const [products, customers, company, categories] = await Promise.all([
      getProducts({ pageSize: 9999 }),
      getCustomers(),
      getCompanySettings(),
      getCategories(),
    ]);

    return (
      <NewSaleClient
        products={serializeWithNumbers(products.data) as unknown as ProductOption[]}
        customers={serialize(customers)}
        categories={serialize(categories) as CategoryOption[]}
        defaultTaxRate={Number(company?.settings?.defaultTaxRate ?? company?.taxRate ?? 0)}
        taxComplianceMode={company?.settings?.taxComplianceMode || "NONE"}
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
