import { getInventoryLocationDetail } from "@/actions/inventory";
import { LocationDetailClient } from "@/features/inventory/locations/location-detail-client";

export const dynamic = "force-dynamic";

export default async function LocationDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let data: any = null;
  try {
    data = await getInventoryLocationDetail(id);
  } catch {}
  return <LocationDetailClient data={data} />;
}
