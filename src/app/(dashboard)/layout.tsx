import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  NAV_GROUPS,
  SIDEBAR_BOTTOM_ITEMS,
  PERMISSIONS,
  getEffectiveUserPermissions,
  type NavItem,
} from "@/lib/constants";
import { applyPlanPermissionLimitsForRole } from "@/lib/plan-features";
import { isExpired, isStarterPlan } from "@/lib/subscription-policy";

const permissionRoutes: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  ...SIDEBAR_BOTTOM_ITEMS,
]
  .concat([
    {
      label: "Reports",
      href: "/reports",
      icon: "BarChart3",
      permissions: ["REPORTS_VIEW"],
    },
    {
      label: "Payment Reminders",
      href: "/payment-reminders",
      icon: "Bell",
      permissions: ["ACCOUNTING_VIEW"],
    },
    {
      label: "Reconciliation",
      href: "/reconciliation",
      icon: "RefreshCw",
      permissions: ["ACCOUNTING_RECONCILE"],
    },
    {
      label: "Customer Ledger",
      href: "/accounts-receivable/ledger",
      icon: "BookOpen",
      permissions: ["ACCOUNTING_VIEW"],
    },
    {
      label: "Supplier Ledger",
      href: "/accounts-payable/ledger",
      icon: "BookOpen",
      permissions: ["ACCOUNTING_VIEW"],
    },
  ])
  .filter((item) => item.href !== "#logout" && item.permissions?.length)
  .sort((a, b) => b.href.split("?")[0].length - a.href.split("?")[0].length);

const getDashboardShellData = unstable_cache(
  async (companyId: string, userId?: string) =>
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        logo: true,
        theme: true,
        settings: { select: { rolePermissions: true } },
        members: {
          where: { userId, isActive: true },
          select: { permissionOverrides: true },
          take: 1,
        },
        subscription: {
          select: {
            id: true,
            status: true,
            endDate: true,
            trialEndDate: true,
            plan: { select: { code: true } },
          },
        },
      },
    }),
  ["dashboard-shell-data"],
  { revalidate: 30 },
);

function routeForPath(pathname: string, companySlug?: string) {
  if (!pathname) return "/";
  const clean = pathname.split("?")[0] || "/";
  if (companySlug && clean === `/${companySlug}`) return "/";
  if (companySlug && clean.startsWith(`/${companySlug}/`)) {
    return clean.slice(companySlug.length + 1) || "/";
  }
  return clean;
}

function canAccessPath(pathname: string, permissions: string[]) {
  if (permissions.length === 0) return false;
  const userSet = new Set(permissions);
  const route = permissionRoutes.find((item) => {
    const href = item.href.split("?")[0];
    return pathname === href || pathname.startsWith(`${href}/`);
  });
  if (!route?.permissions?.length) return false;
  return route.permissions.some((key) => {
    const value = (PERMISSIONS as Record<string, string>)[key];
    return value && userSet.has(value);
  });
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const head = await headers();
  const pathname = head.get("x-pathname") || head.get("x-invoke-path") || "/";

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  const companySlug = (session?.user as { companySlug?: string })?.companySlug;
  const companyId = (session?.user as { companyId?: string })?.companyId;

  let companyName = companySlug;
  let companyLogo: string | null = null;
  let themeSettings: Record<string, string> | null = null;
  let rolePermissions: Record<string, string[]> | null = null;
  let userPermissionOverrides: Record<string, unknown> | null = null;
  let planCode: string | null = "starter";
  let subscriptionRedirectPath: string | null = null;
  let permissionRedirectPath: string | null = null;

  if (companyId) {
    const pathSegments = pathname.split("/").filter(Boolean);
    const routePrefix = pathSegments[0] ? `/${pathSegments[0]}` : "/";
    const pathTenant =
      pathSegments[0] && !permissionRoutes.some((item) => item.href.split("?")[0] === routePrefix)
        ? pathSegments[0]
        : null;
    if (companySlug && pathTenant && pathTenant !== companySlug) {
      redirect(`/${companySlug}/apps`);
    }

    try {
      const company = await getDashboardShellData(companyId, (session?.user as { id?: string })?.id);
      if (company) {
        companyName = company.name;
        companyLogo = company.logo;
      }
      if (company?.theme) themeSettings = company.theme as unknown as Record<string, string>;
      if (company?.settings?.rolePermissions) {
        rolePermissions = company.settings.rolePermissions as unknown as Record<string, string[]>;
      }
      const membership = company?.members[0];
      if (membership?.permissionOverrides) {
        userPermissionOverrides = membership.permissionOverrides as unknown as Record<
          string,
          unknown
        >;
      }

      const isBillingPage = pathname.includes("/billing");
      const subscription = company?.subscription;
      planCode = subscription?.plan?.code || "starter";

      if (!isBillingPage) {
        const starterExpired =
          subscription &&
          isStarterPlan(subscription.plan) &&
          (subscription.status === "TRIAL" || subscription.status === "ACTIVE") &&
          (isExpired(subscription.trialEndDate) || isExpired(subscription.endDate));
        if (starterExpired) {
          await prisma.tenantSubscription.update({
            where: { id: subscription.id },
            data: { status: "SUSPENDED", autoRenew: false },
          });
          subscriptionRedirectPath = companySlug ? `/${companySlug}/billing` : "/billing";
        }
        if (
          subscription &&
          (subscription.status === "EXPIRED" ||
            subscription.status === "SUSPENDED" ||
            subscription.status === "CANCELLED")
        ) {
          subscriptionRedirectPath = companySlug ? `/${companySlug}/billing` : "/billing";
        }
      }

      const unscopedPath = routeForPath(pathname, companySlug);
      const alwaysAllowed = ["/", "/profile", "/help", "/notifications"].some(
        (path) => unscopedPath === path || unscopedPath.startsWith(`${path}/`),
      );
      if (!alwaysAllowed) {
        const userRole = (session?.user as { role?: string })?.role || "";
        const permissions = applyPlanPermissionLimitsForRole(
          getEffectiveUserPermissions(userRole, rolePermissions, userPermissionOverrides),
          planCode,
          userRole,
        );
        if (!canAccessPath(unscopedPath, permissions)) {
          permissionRedirectPath = companySlug ? `/${companySlug}/apps` : "/apps";
        }
      }
    } catch {}
  }

  if (subscriptionRedirectPath) redirect(subscriptionRedirectPath);
  if (permissionRedirectPath) redirect(permissionRedirectPath);

  return (
    <DashboardShell
      companyName={companyName}
      companyLogo={companyLogo}
      themeSettings={themeSettings}
      rolePermissions={rolePermissions}
      userPermissionOverrides={userPermissionOverrides}
      planCode={planCode}
      userRole={(session?.user as { role?: string })?.role || ""}
      userName={session.user.name || "User"}
      userEmail={session.user.email || ""}
      userImage={session.user.image || ""}
    >
      {children}
    </DashboardShell>
  );
}
