import { ProductsPage } from "@/features/inventory/products/products-page";

export default async function TenantProducts(props: { searchParams?: Promise<{ [key: string]: string | undefined }> }) {
  const searchParams = await props.searchParams;
  return <ProductsPage searchParams={searchParams} />;
}
