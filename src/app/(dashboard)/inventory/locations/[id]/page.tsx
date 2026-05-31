import { getInventoryLocationDetail } from "@/actions/inventory";
import { LocationDetailClient } from "@/features/inventory/locations/location-detail-client";
import { ServerLoadError } from "@/components/shared/server-load-error";

export const dynamic = "force-dynamic";

export default async function LocationDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let data: any = null;
  try {
    data = await getInventoryLocationDetail(id);
  } catch (error) {
    console.error("LocationDetailPage load error:", error);
    return (
      <ServerLoadError
        title="Failed to load inventory location"
        message={error instanceof Error ? error.message : "Unable to load inventory data."}
      />
    );
  }
  return <LocationDetailClient data={data} />;
}
