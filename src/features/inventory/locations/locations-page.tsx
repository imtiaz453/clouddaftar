import { getInventoryLocations } from "@/actions/inventory";
import { LocationsListClient } from "./locations-list-client";

export async function LocationsPage({ locationId: _locationId }: { locationId?: string } = {}) {
  const locations = await getInventoryLocations();
  return <LocationsListClient locations={locations as any} />;
}
