import { getStockLocationsWithSummary, getStockLocationDetail, getProductsForSelect } from "@/actions/inventory";
import { LocationsClient } from "./locations-client";
import { serialize } from "@/lib/serialize";

interface LocationsPageProps {
  locationId?: string | null;
}

export async function LocationsPage({ locationId }: LocationsPageProps) {
  const [locations, products] = await Promise.all([
    getStockLocationsWithSummary(),
    getProductsForSelect(),
  ]);

  let locationDetail = null;
  if (locationId) {
    locationDetail = await getStockLocationDetail(locationId);
  }

  return (
    <LocationsClient
      locations={serialize(locations) as any}
      locationDetail={serialize(locationDetail) as any}
      products={serialize(products) as any}
      locationId={locationId || null}
    />
  );
}
