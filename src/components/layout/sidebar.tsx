"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  NAV_GROUPS,
  SIDEBAR_BOTTOM_ITEMS,
  getEffectiveUserPermissions,
  PERMISSIONS,
  type NavGroup,
  type NavItem,
} from "@/lib/constants";
import { applyPlanPermissionLimitsForRole } from "@/lib/plan-features";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  BarChart3,
  Settings,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Building,
  Shield,
  CreditCard,
  Wallet,
  ClipboardCheck,
  Bell,
  FileSpreadsheet,
  FileText,
  Activity,
  RotateCcw,
  TrendingUp,
  PieChart,
  ShoppingBag,
  TrendingDown,
  Layers,
  Ruler,
  ScanLine,
  ArrowUpDown,
  BookOpen,
  AlertTriangle,
  DollarSign,
  Palette,
  HelpCircle,
  LogOut,
  ChevronDown,
  ClipboardList,
  ReceiptText,
  Banknote,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  BarChart3,
  Settings,
  UserCog,
  Building,
  Shield,
  CreditCard,
  Wallet,
  ClipboardCheck,
  Bell,
  FileSpreadsheet,
  FileText,
  Activity,
  RotateCcw,
  TrendingUp,
  PieChart,
  ShoppingBag,
  TrendingDown,
  Layers,
  Ruler,
  ScanLine,
  ArrowUpDown,
  BookOpen,
  AlertTriangle,
  DollarSign,
  Palette,
  HelpCircle,
  LogOut,
  ChevronDown,
  ClipboardList,
  ReceiptText,
  Banknote,
  Store,
};

interface SidebarProps {
  companyName?: string;
  companyLogo?: string | null;
  mobileOpen?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onMobileClose?: () => void;
  themeSettings?: Record<string, string> | null;
  rolePermissions?: Record<string, string[]> | null;
  userPermissionOverrides?: Record<string, unknown> | null;
  planCode?: string | null;
  userRole?: string;
}

function isActiveRoute(
  pathname: string,
  href: string,
  searchParams?: URLSearchParams,
  allHrefs?: Set<string>,
): boolean {
  if (href === "/") return pathname === "/" || pathname.split("/").filter(Boolean).length === 1;
  if (href.includes("?")) {
    const [base, query] = href.split("?");
    const queryParams = new URLSearchParams(query);
    if (pathname !== base) return false;
    return Array.from(queryParams.entries()).every(
      ([key, value]) => searchParams?.get(key) === value,
    );
  }
  if (href.endsWith("/settings") && pathname === href && searchParams?.has("tab")) return false;
  if (pathname === href) return true;
  if (pathname.startsWith(href + "/")) {
    const nextSegment = pathname.slice(href.length + 1).split("/")[0];
    if (allHrefs && nextSegment && allHrefs.has(href + "/" + nextSegment)) return false;
    return true;
  }
  return false;
}

const ALL_PERMISSION_VALUES = new Set(Object.values(PERMISSIONS));
const MODULE_SCOPED_GROUPS = new Set([
  "POS",
  "Sales",
  "Purchases",
  "Inventory",
  "Contacts",
  "Accounting",
  "Expenses",
  "Employees",
  "Reports",
  "Administration",
]);

function useUserPermissions(
  rolePermissions?: Record<string, string[]> | null,
  userPermissionOverrides?: Record<string, unknown> | null,
  planCode?: string | null,
  userRole = "",
) {
  return useMemo(() => {
    return applyPlanPermissionLimitsForRole(
      getEffectiveUserPermissions(userRole, rolePermissions, userPermissionOverrides),
      planCode,
      userRole,
    );
  }, [userRole, rolePermissions, userPermissionOverrides, planCode]);
}

function hasAnyPermission(itemPerms: string[] | undefined, userPerms: string[]): boolean {
  if (!itemPerms || itemPerms.length === 0) return true;
  const userSet = new Set(userPerms);
  return itemPerms.some((key) => {
    const permValue = (PERMISSIONS as Record<string, string>)[key];
    return permValue && userSet.has(permValue);
  });
}

function filterNavGroups(groups: NavGroup[], permissions: string[]): NavGroup[] {
  if (permissions.length === 0 || permissions.length >= ALL_PERMISSION_VALUES.size) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAnyPermission(item.permissions, permissions)),
    }))
    .filter((group) => group.items.length > 0);
}

function filterBottomItems(items: NavItem[], permissions: string[]): NavItem[] {
  if (permissions.length === 0 || permissions.length >= ALL_PERMISSION_VALUES.size) return items;
  return items.filter((item) => hasAnyPermission(item.permissions, permissions));
}

function NavItemLink({
  item,
  collapsed,
  tenant,
  pathname,
  searchParams,
  onClose,
  onLogoutClick,
  allHrefs,
}: {
  item: NavItem;
  collapsed: boolean;
  tenant: string | null;
  pathname: string;
  searchParams: URLSearchParams;
  onClose?: () => void;
  onLogoutClick: () => void;
  allHrefs?: Set<string>;
}) {
  const Icon = iconMap[item.icon] as LucideIcon | undefined;
  const href =
    item.href === "#logout"
      ? "#"
      : tenant
        ? `/${tenant}${item.href === "/" ? "" : item.href}`
        : item.href;
  const active = item.href !== "#logout" && isActiveRoute(pathname, href, searchParams, allHrefs);

  if (item.href === "#logout") {
    return (
      <button
        onClick={() => {
          onClose?.();
          onLogoutClick();
        }}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-neutral-tertiary hover:text-fg-brand"
      >
        {Icon && <Icon className="h-5 w-5 shrink-0" />}
        {!collapsed && <span>{item.label}</span>}
      </button>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClose}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-all duration-150",
        active
          ? "bg-neutral-tertiary text-fg-brand font-medium shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-neutral-tertiary hover:text-fg-brand",
      )}
    >
      {active && !collapsed && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-fg-brand" />
      )}
      {Icon && (
        <Icon
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            active ? "text-fg-brand" : "text-sidebar-foreground/50 group-hover:text-fg-brand",
          )}
        />
      )}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge != null && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

function NavGroupSection({
  group,
  collapsed,
  tenant,
  pathname,
  searchParams,
  onClose,
  defaultOpen,
  onLogoutClick,
  allHrefs,
}: {
  group: NavGroup;
  collapsed: boolean;
  tenant: string | null;
  pathname: string;
  searchParams: URLSearchParams;
  onClose?: () => void;
  defaultOpen: boolean;
  onLogoutClick: () => void;
  allHrefs?: Set<string>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const GroupIcon = iconMap[group.icon] as LucideIcon | undefined;

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavItemLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            tenant={tenant}
            pathname={pathname}
            searchParams={searchParams}
            onClose={onClose}
            onLogoutClick={onLogoutClick}
            allHrefs={allHrefs}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50 transition-colors hover:bg-neutral-tertiary hover:text-sidebar-foreground"
      >
        {GroupIcon && <GroupIcon className="h-4 w-4 shrink-0" />}
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="ml-3 space-y-0.5 border-l border-sidebar-border/50 pl-2">
          {group.items.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              tenant={tenant}
              pathname={pathname}
              searchParams={searchParams}
              onClose={onClose}
              onLogoutClick={onLogoutClick}
              allHrefs={allHrefs}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function getTenantFromPathname(pathname: string, allRoutes: Set<string>): string | null {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length >= 2 && !allRoutes.has("/" + segments[0]) ? segments[0] : null;
}

export function Sidebar({
  companyName,
  companyLogo,
  mobileOpen,
  collapsed: collapsedProp,
  onToggleCollapse,
  onMobileClose,
  rolePermissions,
  userPermissionOverrides,
  planCode,
  userRole,
}: SidebarProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useMemo(() => useSearchParams() ?? new URLSearchParams(), []);
  const permissions = useUserPermissions(rolePermissions, userPermissionOverrides, planCode, userRole);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [logo, setLogo] = useState(companyLogo);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const collapsed = collapsedProp ?? internalCollapsed;

  useEffect(() => {
    setLogo(companyLogo);
  }, [companyLogo]);

  useEffect(() => {
    function handleLogoUpdate(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.url) setLogo(detail.url);
    }
    window.addEventListener("logo-updated", handleLogoUpdate);
    return () => window.removeEventListener("logo-updated", handleLogoUpdate);
  }, []);

  const allRoutes = useMemo(() => {
    const routes = new Set<string>();
    NAV_GROUPS.forEach((g) => g.items.forEach((i) => routes.add(i.href)));
    SIDEBAR_BOTTOM_ITEMS.forEach((i) => routes.add(i.href));
    return routes;
  }, []);

  const tenant = useMemo(() => getTenantFromPathname(pathname, allRoutes), [pathname, allRoutes]);

  const tenantHref = useCallback(
    (href: string) => {
      return tenant ? `/${tenant}${href === "/" ? "" : href}` : href;
    },
    [tenant],
  );

  const filteredGroups = useMemo(() => filterNavGroups(NAV_GROUPS, permissions), [permissions]);

  const filteredBottom = useMemo(
    () => filterBottomItems(SIDEBAR_BOTTOM_ITEMS, permissions),
    [permissions],
  );

  const prefixedRoutes = useMemo(() => {
    if (!tenant) return allRoutes;
    const prefixed = new Set<string>();
    allRoutes.forEach((href) => prefixed.add(tenant ? `/${tenant}${href === "/" ? "" : href}` : href));
    return prefixed;
  }, [tenant, allRoutes]);

  const activeModuleGroup = useMemo(() => {
    if (pathname === tenantHref("/") || pathname === tenantHref("/apps")) return null;
    return (
      filteredGroups.find(
        (group) =>
          MODULE_SCOPED_GROUPS.has(group.label) &&
          group.items.some((item) => isActiveRoute(pathname, tenantHref(item.href), searchParams, prefixedRoutes)),
      ) ?? null
    );
  }, [filteredGroups, pathname, searchParams, tenantHref, prefixedRoutes]);

  const expandedGroupLabels = useMemo(() => {
    const labels = new Set<string>();
    NAV_GROUPS.forEach((group) => {
      const hasActive = group.items.some((item) => {
        const href = tenantHref(item.href);
        return isActiveRoute(pathname, href, searchParams, prefixedRoutes);
      });
      if (hasActive) labels.add(group.label);
    });
    return labels;
  }, [pathname, tenantHref, searchParams, prefixedRoutes]);

  function handleToggle() {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  }

  const handleClose = useCallback(() => {
    onMobileClose?.();
  }, [onMobileClose]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={handleClose} />
      )}
      <aside
        className={cn(
          "sidebar-base fixed left-0 top-0 z-50 flex h-screen flex-col transition-all duration-300 ease-out",
          "border-r border-sidebar-border/50",
          collapsed ? "w-[4.25rem]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center border-b border-sidebar-border/70 px-3">
          <Link
            href={tenantHref("/")}
            prefetch={false}
            className="flex min-w-0 items-center gap-3 px-2 py-2 transition-all"
            onClick={handleClose}
          >
            {logo ? (
              <img
                src={logo}
                alt="Logo"
                className="h-9 w-9 rounded-lg bg-white/90 object-contain p-1 shadow-sm"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm shadow-black/20">
                <Building className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            {!collapsed && (
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-bold text-sidebar-foreground">Cloud Daftar</span>
                {companyName && companyName !== "Cloud Daftar" && (
                  <span className="truncate text-xs text-sidebar-foreground/60">{companyName}</span>
                )}
              </div>
            )}
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <nav className="space-y-3">
            {activeModuleGroup && !collapsed && (
              <div className="space-y-1 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/35 p-2">
                <Link
                  href={tenantHref("/apps")}
                  prefetch={false}
                  onClick={handleClose}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase text-sidebar-foreground/60 transition-colors hover:bg-neutral-tertiary hover:text-sidebar-foreground"
                >
                  <Layers className="h-4 w-4" />
                  <span>All Apps</span>
                </Link>
                <div className="px-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/40">
                  {activeModuleGroup.label} Module
                </div>
              </div>
            )}
            {activeModuleGroup && collapsed && (
              <NavItemLink
                item={{
                  label: "Apps",
                  href: "/apps",
                  icon: "Layers",
                  permissions: ["DASHBOARD_VIEW"],
                }}
                collapsed={collapsed}
                tenant={tenant}
                pathname={pathname}
                searchParams={searchParams}
                onClose={handleClose}
                onLogoutClick={() => setLogoutConfirmOpen(true)}
                allHrefs={prefixedRoutes}
              />
            )}
            {filteredGroups.map((group) => (
              <NavGroupSection
                key={group.label}
                group={group}
                collapsed={collapsed}
                tenant={tenant}
                pathname={pathname}
                searchParams={searchParams}
                onClose={handleClose}
                defaultOpen={expandedGroupLabels.has(group.label)}
                onLogoutClick={() => setLogoutConfirmOpen(true)}
                allHrefs={prefixedRoutes}
              />
            ))}
          </nav>
        </div>

        <div className="space-y-0.5 border-t border-sidebar-border px-2 py-2">
          {filteredBottom.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              tenant={tenant}
              pathname={pathname}
              searchParams={searchParams}
              onClose={handleClose}
              onLogoutClick={() => setLogoutConfirmOpen(true)}
              allHrefs={prefixedRoutes}
            />
          ))}
          <div className={cn("pt-1", collapsed && "flex justify-center")}>
            <button
              onClick={handleToggle}
              className="flex w-full items-center justify-center rounded-lg px-3 py-1.5 text-sidebar-foreground/55 transition-colors hover:bg-neutral-tertiary hover:text-sidebar-foreground"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title="Log out?"
        description="You will be signed out and returned to the login screen."
        confirmText="Log out"
        confirmVariant="warning"
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          void signOut({ callbackUrl: "/login" });
        }}
      />
    </>
  );
}


