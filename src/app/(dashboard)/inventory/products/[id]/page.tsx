import { getProductDetail } from "@/actions/inventory";
import { ProductDetailClient } from "@/features/inventory/products/product-detail-client";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let data: any = null;
  let error = false;
  try {
    data = await getProductDetail(id);
  } catch {
    error = true;
  }
  return <ProductDetailClient data={data} />;
}
