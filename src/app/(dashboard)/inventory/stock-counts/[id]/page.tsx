import { getStockCountDetail } from "@/actions/inventory";
import { StockCountDetailClient } from "@/features/inventory/stock-counts/stock-count-detail-client";

export const dynamic = "force-dynamic";

export default async function StockCountDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <StockCountDetailClient countId={id} open={true} onOpenChange={() => {}} />;
}
