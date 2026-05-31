import { getProducts, getCategories, getInventoryLocations } from "@/actions/inventory";
import { ProductsClient } from "@/features/inventory/products/products-client";
import { ServerLoadError } from "@/components/shared/server-load-error";

export const dynamic = "force-dynamic";

export default async function ProductsPage(props: { searchParams?: Promise<{ [key: string]: string | undefined }> }) {
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
  } catch (error) {
    console.error("ProductsPage load error:", error);
    return (
      <ServerLoadError
        title="Failed to load inventory products"
        message={error instanceof Error ? error.message : "Unable to load inventory data."}
      />
    );
  }

  return (
    <ProductsClient
      initialData={productsData}
      categories={categories}
      locations={locations}
    />
  );
}
