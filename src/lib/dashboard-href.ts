const DASHBOARD_ROOTS = new Set([
  "apps",
  "inventory",
  "expenses",
  "accounting",
  "sales",
  "purchases",
  "customers",
  "suppliers",
  "reports",
  "settings",
  "users",
  "profile",
  "billing",
  "quotations",
  "accounts-receivable",
  "accounts-payable",
  "customer-payments",
  "supplier-payments",
]);

export function dashboardHref(
  pathname: string | null | undefined,
  targetPath: string,
  params?: Record<string, string>,
) {
  const cleanTarget = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  const first = (pathname || "").split("/").filter(Boolean)[0];
  const prefix = first && !DASHBOARD_ROOTS.has(first) && first !== "api" ? `/${first}` : "";
  const url = new URL(`${prefix}${cleanTarget}`, "https://local.cloud-daftar");
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return `${url.pathname}${url.search}`;
}
