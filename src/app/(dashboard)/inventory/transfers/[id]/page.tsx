import TransferDetailPage from "@/features/inventory/transfers/transfer-detail-page";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransferDetailPage params={{ id }} />;
}
