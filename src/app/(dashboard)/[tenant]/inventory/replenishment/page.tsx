import { getReplenishmentData } from "@/actions/inventory";
import { ReplenishmentClient } from "@/features/inventory/replenishment/replenishment-client";
import { ServerLoadError } from "@/components/shared/server-load-error";

export const dynamic = "force-dynamic";

export default async function ReplenishmentPage() {
  let initialData: any = null;
  try {
    initialData = await getReplenishmentData();
  } catch (error) {
    console.error("ReplenishmentPage load error:", error);
    return (
      <ServerLoadError
        title="Failed to load replenishment data"
        message={error instanceof Error ? error.message : "Unable to load inventory data."}
      />
    );
  }
  return <ReplenishmentClient initialData={initialData} />;
}
