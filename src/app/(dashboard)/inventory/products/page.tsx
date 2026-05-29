import { ProductsPage } from "@/features/inventory/products/products-page";

export const dynamic = "force-dynamic";

export default async function Page(props: { searchParams?: Promise<{ [key: string]: string | undefined }> }) {
  const searchParams = await props.searchParams;
  return <ProductsPage searchParams={searchParams} />;
}
