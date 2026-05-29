import { getStockLedgerData } from "@/actions/inventory-new";
import { StockLedgerClient } from "@/features/inventory/ledger/stock-ledger-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const initialData = await getStockLedgerData({});
  return <StockLedgerClient initialData={initialData as any} />;
}
