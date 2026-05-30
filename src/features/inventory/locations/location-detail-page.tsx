import { getInventoryLocationDetail } from "@/actions/inventory-new";
import { LocationDetailClient } from "./location-detail-client";

interface LocationDetailPageProps {
  params: { id: string };
}

export default async function LocationDetailPage({ params }: LocationDetailPageProps) {
  const data = await getInventoryLocationDetail(params.id);
  return <LocationDetailClient data={data as any} />;
}
