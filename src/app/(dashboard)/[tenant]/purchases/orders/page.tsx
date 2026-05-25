import { redirect } from "next/navigation";

export default async function TenantPurchaseOrders({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  redirect(`/${tenant}/purchases`);
}
