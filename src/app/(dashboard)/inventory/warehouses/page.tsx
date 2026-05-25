import { WarehousesPage } from "@/features/inventory/warehouses/warehouses-page";

export default async function Warehouses(props: { searchParams?: Promise<{ warehouseId?: string }> }) {
  const searchParams = await props.searchParams;
  return <WarehousesPage warehouseId={searchParams?.warehouseId} />;
}
