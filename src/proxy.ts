import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/api/auth", "/cloud-daftar-admin"];
const dashboardPaths = ["/", "/apps", "/inventory", "/inventory/categories", "/inventory/units", "/inventory/warehouses", "/inventory/adjustments", "/inventory/ledger", "/inventory/low-stock", "/inventory/barcodes", "/expenses", "/accounting", "/accounting/expenses", "/sales", "/sales/new", "/sales/returns", "/purchases", "/purchases/orders", "/purchases/returns", "/customers", "/suppliers", "/reports", "/reports/sales", "/reports/purchases", "/reports/inventory", "/reports/tax", "/reports/customer-statement", "/reports/supplier-statement", "/settings", "/settings/templates", "/users", "/users/roles", "/profile", "/accounts-receivable", "/accounts-receivable/aging", "/accounts-receivable/ledger", "/accounts-payable", "/accounts-payable/aging", "/accounts-payable/ledger", "/reconciliation", "/payment-reminders", "/accounting-reports", "/billing", "/audit-log", "/customer-payments", "/supplier-payments", "/quotations", "/income-expense", "/cash-flow", "/help", "/notifications", "/payment-reminders"];
const PUBLIC_FILE = /\.(.*)$/;

function isPublicPath(path: string) {
  if (publicPaths.some((p) => path.startsWith(p))) return true;
  return isTenantPublicPath(path);
}

function isTenantPublicPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  const first = segments[0];
  if (first.startsWith("cloud-daftar-") || first === "api" || first === "_next") return false;
  const tenantPublicPaths = ["login", "register", "forgot-password"];
  if (tenantPublicPaths.includes(segments[1])) return true;
  if (segments[1] === "reset-password") return true;
  return false;
}

function isDashboardPath(path: string) {
  return dashboardPaths.some((p) => path === p || path.startsWith(p + "/"));
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const segments = path.split("/").filter(Boolean);

  // Safety guard: never intercept API, _next, or static assets
  if (
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path.startsWith("/manuals") ||
    path === "/favicon.ico" ||
    PUBLIC_FILE.test(path)
  ) {
    return NextResponse.next();
  }

  // Rewrite /{tenant}/login → /login?tenant={tenant}
  // This keeps the pretty URL in the browser while serving the login page
  if (
    segments.length === 2 &&
    segments[1] === "login" &&
    !segments[0].startsWith("cloud-daftar-") &&
    segments[0] !== "api" &&
    segments[0] !== "_next"
  ) {
    const url = new URL("/login", req.url);
    url.searchParams.set("tenant", segments[0]);
    return NextResponse.rewrite(url);
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", path);

  if (isPublicPath(path)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  const companySlug = (token as any).companySlug as string | undefined;

  if (companySlug && isDashboardPath(path)) {
    if (path === "/") {
      return NextResponse.redirect(new URL(`/${companySlug}/apps`, req.url));
    }
    return NextResponse.redirect(new URL(`/${companySlug}${path}`, req.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
