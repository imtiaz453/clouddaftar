import { ProductDetailPage } from "@/features/inventory/products/detail/product-detail-page";

export default async function TenantProductDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <ProductDetailPage productId={id} />;
}
