import { getStockLedgerData, getInventoryLocations, getStockMovementTypes } from "@/actions/inventory";
import { LedgerClient } from "@/features/inventory/ledger/ledger-client";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const [initialData, locations, movementTypes] = await Promise.all([
    getStockLedgerData({ page: 1, pageSize: 50 }).catch(() => null),
    getInventoryLocations().catch(() => []),
    getStockMovementTypes().catch(() => []),
  ]);

  return <LedgerClient initialData={initialData as any} />;
}
