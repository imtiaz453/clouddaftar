import { getProductLots } from "@/actions/inventory";
import { LotsClient } from "@/features/inventory/lots/lots-client";

export const dynamic = "force-dynamic";

export default async function LotsPage() {
  let initialData: any = null;
  try {
    initialData = await getProductLots({ page: 1, pageSize: 30 });
  } catch {}
  return <LotsClient initialData={initialData} />;
}
