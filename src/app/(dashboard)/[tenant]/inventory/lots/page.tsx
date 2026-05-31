import { getProductLots } from "@/actions/inventory";
import { LotsClient } from "@/features/inventory/lots/lots-client";
import { ServerLoadError } from "@/components/shared/server-load-error";

export const dynamic = "force-dynamic";

export default async function LotsPage() {
  let initialData: any = null;
  try {
    initialData = await getProductLots({ page: 1, pageSize: 30 });
  } catch (error) {
    console.error("LotsPage load error:", error);
    return (
      <ServerLoadError
        title="Failed to load product lots"
        message={error instanceof Error ? error.message : "Unable to load inventory data."}
      />
    );
  }
  return <LotsClient initialData={initialData} />;
}
