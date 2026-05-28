import { getProductDetail } from "@/actions/inventory";
import { ProductDetailClient } from "./product-detail-client";
import { serialize } from "@/lib/serialize";

interface ProductDetailPageProps {
  productId: string;
}

export async function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const data = await getProductDetail(productId);

  if (!data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  return <ProductDetailClient data={serialize(data) as any} />;
}
