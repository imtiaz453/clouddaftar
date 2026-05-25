export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  return <>{children}</>;
}
