import { getProducts, getCategories, getStockLocations } from "@/actions/inventory";
import { ProductsClient } from "./products-client";
import { serialize } from "@/lib/serialize";

interface ProductsPageProps {
  searchParams?: { [key: string]: string | undefined };
}

export async function ProductsPage({ searchParams }: ProductsPageProps) {
  const sp = searchParams || {};

  const [products, categories, locations] = await Promise.all([
    getProducts({
      search: sp.search,
      categoryId: sp.categoryId,
      page: sp.page ? Number(sp.page) : 1,
      pageSize: 50,
      isActive: sp.isActive === "true" ? true : sp.isActive === "false" ? false : undefined,
      stockStatus: (sp.stockStatus as "all" | "low" | "out") || undefined,
      locationId: sp.locationId,
    }),
    getCategories(),
    getStockLocations(),
  ]);

  return (
    <ProductsClient
      initialData={serialize(products) as any}
      categories={serialize(categories)}
      locations={serialize(locations)}
    />
  );
}
