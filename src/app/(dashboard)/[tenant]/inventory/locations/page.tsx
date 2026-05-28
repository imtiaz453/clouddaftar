import { LocationsPage } from "@/features/inventory/locations/locations-page";

export default async function TenantLocations(props: { searchParams?: Promise<{ locationId?: string }> }) {
  const searchParams = await props.searchParams;
  return <LocationsPage locationId={searchParams?.locationId} />;
}
