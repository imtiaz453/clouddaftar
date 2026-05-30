import { getProducts, getCategories, getInventoryLocations } from "@/actions/inventory";
import { ProductsClient } from "@/features/inventory/products/products-client";

export const dynamic = "force-dynamic";

export default async function TenantProducts(props: { searchParams?: Promise<{ [key: string]: string | undefined }> }) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams?.page) || 1;
  const stockStatus = (searchParams?.stockStatus as "all" | "low" | "out") || "all";

  let productsData: any = null;
  let categories: any[] = [];
  let locations: any[] = [];

  try {
    [productsData, categories, locations] = await Promise.all([
      getProducts({ page, pageSize: 20, stockStatus: stockStatus === "all" ? undefined : stockStatus }),
      getCategories(),
      getInventoryLocations(),
    ]);
  } catch {
    // handled by client
  }

  return (
    <ProductsClient
      initialData={productsData}
      categories={categories}
      locations={locations}
    />
  );
}
