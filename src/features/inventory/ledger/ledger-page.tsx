import { getStockLedgerV2, getStockLocations, getStockMovementTypes } from "@/actions/inventory";
import { LedgerClient } from "./ledger-client";
import { serialize } from "@/lib/serialize";

export async function LedgerPage() {
  const [data, locations, movementTypes] = await Promise.all([
    getStockLedgerV2({ page: 1, pageSize: 50 }),
    getStockLocations(),
    getStockMovementTypes().catch(() => []),
  ]);

  return (
    <LedgerClient
      initialData={serialize(data) as any}
      locations={serialize(locations) as any}
      movementTypeOptions={movementTypes}
    />
  );
}
