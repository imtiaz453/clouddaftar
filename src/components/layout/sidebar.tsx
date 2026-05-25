"use client";

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from "react";
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

function isActiveRoute(pathname: string, href: string, searchParams?: URLSearchParams): boolean {
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
  return pathname === href || pathname.startsWith(href + "/");
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
  glass,
}: {
  item: NavItem;
  collapsed: boolean;
  tenant: string | null;
  pathname: string;
  searchParams: URLSearchParams;
  onClose?: () => void;
  onLogoutClick: () => void;
  glass: boolean;
}) {
  const Icon = iconMap[item.icon] as LucideIcon | undefined;
  const href =
    item.href === "#logout"
      ? "#"
      : tenant
        ? `/${tenant}${item.href === "/" ? "" : item.href}`
        : item.href;
  const active = item.href !== "#logout" && isActiveRoute(pathname, href, searchParams);

  if (item.href === "#logout") {
    return (
      <button
        onClick={() => {
          onClose?.();
          onLogoutClick();
        }}
        className={cn(
          glass
            ? "hover:bg-white/44 group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/70 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-sidebar-foreground hover:shadow-[0_18px_38px_rgba(255,255,255,0.34),0_10px_24px_rgba(18,24,30,0.12),inset_0_1px_1px_rgba(255,255,255,0.72)] active:translate-y-0 active:scale-[0.98]"
            : "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
        )}
      >
        {Icon && (
          <>
            {glass ? (
              <span className="bg-white/34 group-hover:bg-white/52 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.78),0_8px_18px_rgba(18,24,30,0.08)] transition-all duration-300 group-hover:text-sidebar-foreground">
                <Icon className="h-[18px] w-[18px]" />
              </span>
            ) : (
              <Icon className="h-5 w-5 shrink-0" />
            )}
          </>
        )}
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
        glass
          ? "group relative isolate flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2 text-sm font-semibold transition-all duration-300 ease-out before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:opacity-0 before:shadow-[inset_0_1px_1px_rgba(255,255,255,0.82),inset_0_-1px_1px_rgba(255,255,255,0.28)] before:transition-opacity before:duration-300 after:absolute after:inset-y-2 after:left-0 after:w-1 after:rounded-r-full after:opacity-0 after:transition-all after:duration-300"
          : "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        glass
          ? active
            ? "bg-white/54 before:bg-white/36 text-sidebar-foreground shadow-[0_22px_48px_rgba(255,255,255,0.42),0_12px_28px_rgba(18,24,30,0.14),inset_0_1px_1px_rgba(255,255,255,0.82)] before:opacity-100 after:bg-sidebar-foreground/80 after:opacity-100"
            : "text-sidebar-foreground/72 hover:bg-white/44 hover:-translate-y-0.5 hover:text-sidebar-foreground hover:shadow-[0_18px_38px_rgba(255,255,255,0.34),0_10px_24px_rgba(18,24,30,0.12),inset_0_1px_1px_rgba(255,255,255,0.72)] active:translate-y-0 active:scale-[0.98]"
          : active
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      {Icon && (
        <>
          {glass ? (
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                active
                  ? "bg-white/50 text-sidebar-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.82),0_8px_18px_rgba(18,24,30,0.08)]"
                  : "group-hover:bg-white/52 bg-white/30 text-sidebar-foreground/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.62),0_8px_18px_rgba(18,24,30,0.06)] group-hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
          ) : (
            <Icon className="h-5 w-5 shrink-0" />
          )}
        </>
      )}
      {!collapsed && <span className="truncate">{item.label}</span>}
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
  glass,
}: {
  group: NavGroup;
  collapsed: boolean;
  tenant: string | null;
  pathname: string;
  searchParams: URLSearchParams;
  onClose?: () => void;
  defaultOpen: boolean;
  onLogoutClick: () => void;
  glass: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const GroupIcon = iconMap[group.icon] as LucideIcon | undefined;

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (collapsed) {
    return (
      <div className="space-y-1">
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
            glass={glass}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          glass
            ? "text-sidebar-foreground/48 hover:bg-white/34 group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-normal transition-all duration-300 hover:text-sidebar-foreground hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.62)]"
            : "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-normal text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        {GroupIcon && (
          <>
            {glass ? (
              <span className="bg-white/24 group-hover:bg-white/42 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.58)] transition-colors">
                <GroupIcon className="h-3.5 w-3.5" />
              </span>
            ) : (
              <GroupIcon className="h-4 w-4 shrink-0" />
            )}
          </>
        )}
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
        <div
          className={cn(
            "space-y-1 border-l pl-2",
            glass ? "border-white/42 ml-[15px]" : "ml-[7px] border-sidebar-border/50",
          )}
        >
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
              glass={glass}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  companyName,
  companyLogo,
  mobileOpen,
  collapsed: collapsedProp,
  onToggleCollapse,
  onMobileClose,
  themeSettings,
  rolePermissions,
  userPermissionOverrides,
  planCode,
  userRole,
}: SidebarProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const permissions = useUserPermissions(rolePermissions, userPermissionOverrides, planCode, userRole);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [logo, setLogo] = useState(companyLogo);
  const [sidebarStyle, setSidebarStyle] = useState("gradient");
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const collapsed = collapsedProp ?? internalCollapsed;
  const isGlassTheme = sidebarStyle === "glass";

  useEffect(() => {
    setLogo(companyLogo);
  }, [companyLogo]);

  useEffect(() => {
    function readSidebarStyle() {
      const inline = document.documentElement.style.getPropertyValue("--sidebar-style").trim();
      if (inline) setSidebarStyle(inline);
    }
    const observer = new MutationObserver(readSidebarStyle);
    observer.observe(document.documentElement, { attributeFilter: ["style"] });
    readSidebarStyle();
    window.addEventListener("theme-updated", readSidebarStyle);
    return () => {
      observer.disconnect();
      window.removeEventListener("theme-updated", readSidebarStyle);
    };
  }, []);

  useEffect(() => {
    function handleLogoUpdate(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.url) setLogo(detail.url);
    }
    window.addEventListener("logo-updated", handleLogoUpdate);
    return () => window.removeEventListener("logo-updated", handleLogoUpdate);
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const allRoutes = useMemo(() => {
    const routes = new Set<string>();
    NAV_GROUPS.forEach((g) => g.items.forEach((i) => routes.add(i.href)));
    SIDEBAR_BOTTOM_ITEMS.forEach((i) => routes.add(i.href));
    return routes;
  }, []);
  const tenant = segments.length >= 2 && !allRoutes.has("/" + segments[0]) ? segments[0] : null;

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

  const activeModuleGroup = useMemo(() => {
    if (pathname === tenantHref("/") || pathname === tenantHref("/apps")) return null;
    return (
      filteredGroups.find(
        (group) =>
          MODULE_SCOPED_GROUPS.has(group.label) &&
          group.items.some((item) => isActiveRoute(pathname, tenantHref(item.href), searchParams)),
      ) ?? null
    );
  }, [filteredGroups, pathname, searchParams, tenantHref]);

  const visibleGroups = filteredGroups;

  const expandedGroupLabels = useMemo(() => {
    const labels = new Set<string>();
    NAV_GROUPS.forEach((group) => {
      const hasActive = group.items.some((item) => {
        const href = tenantHref(item.href);
        return isActiveRoute(pathname, href, searchParams);
      });
      if (hasActive) labels.add(group.label);
    });
    return labels;
  }, [pathname, tenantHref, searchParams]);

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
          isGlassTheme
            ? "border-r border-white/45 shadow-[18px_0_58px_rgba(18,24,30,0.16)] backdrop-blur-3xl"
            : "border-r border-sidebar-border/50 shadow-panel-lg",
          collapsed ? "w-[4.25rem]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          sidebarStyle === "minimal" && "sidebar-minimal",
          sidebarStyle === "gradient" && "sidebar-gradient",
          sidebarStyle === "glass" && "sidebar-glass",
          (!sidebarStyle || sidebarStyle === "solid") && "sidebar-solid",
        )}
        style={
          isGlassTheme
            ? ({
                backgroundColor: "rgba(242, 243, 243, 0.42)",
                ["--sidebar-background" as string]: "210 7% 86%",
                ["--sidebar-foreground" as string]: "220 14% 8%",
                ["--sidebar-primary" as string]: "220 14% 8%",
                ["--sidebar-primary-foreground" as string]: "0 0% 100%",
                ["--sidebar-accent" as string]: "0 0% 100%",
                ["--sidebar-border" as string]: "0 0% 100%",
              } as CSSProperties)
            : undefined
        }
      >
        <div
          className={cn(
            "sidebar-header-height flex items-center px-3",
            isGlassTheme ? "border-b border-white/40" : "border-b border-sidebar-border/70",
          )}
        >
          <Link
            href={tenantHref("/")}
            prefetch={false}
            className={cn(
              "group flex min-w-0 items-center gap-3 px-2 py-2 transition-all",
              isGlassTheme
                ? "hover:bg-white/34 rounded-2xl duration-300"
                : "rounded-lg duration-200",
            )}
            onClick={handleClose}
          >
            {logo ? (
              <img
                src={logo}
                alt="Logo"
                className={cn(
                  "object-contain",
                  isGlassTheme
                    ? "bg-white/64 h-10 w-10 rounded-2xl p-1.5 shadow-[0_18px_38px_rgba(255,255,255,0.38),0_10px_24px_rgba(18,24,30,0.12),inset_0_1px_1px_rgba(255,255,255,0.82)] backdrop-blur-2xl transition-transform duration-300 group-hover:-translate-y-0.5"
                    : "h-9 w-9 rounded-lg bg-white/90 p-1 shadow-sm",
                )}
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center",
                  isGlassTheme
                    ? "bg-white/58 h-10 w-10 rounded-2xl text-sidebar-foreground shadow-[0_18px_38px_rgba(255,255,255,0.38),0_10px_24px_rgba(18,24,30,0.12),inset_0_1px_1px_rgba(255,255,255,0.82)] backdrop-blur-2xl transition-transform duration-300 group-hover:-translate-y-0.5"
                    : "h-9 w-9 rounded-lg bg-sidebar-primary shadow-sm shadow-black/20",
                )}
              >
                <Building
                  className={cn(
                    isGlassTheme ? "h-[18px] w-[18px]" : "h-4 w-4 text-primary-foreground",
                  )}
                />
              </div>
            )}
            {!collapsed && (
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-extrabold text-sidebar-foreground">Cloud Daftar</span>
                {companyName && companyName !== "Cloud Daftar" && (
                  <span className="truncate text-xs text-sidebar-foreground/60">{companyName}</span>
                )}
              </div>
            )}
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-4">
          <nav className="space-y-4">
            {activeModuleGroup && !collapsed && (
              <div
                className={cn(
                  "space-y-2 p-2",
                  isGlassTheme
                    ? "border-white/42 bg-white/24 rounded-2xl border shadow-[inset_0_1px_1px_rgba(255,255,255,0.62)]"
                    : "rounded-lg border border-sidebar-border/60 bg-sidebar-accent/35",
                )}
              >
                <Link
                  href={tenantHref("/apps")}
                  prefetch={false}
                  onClick={handleClose}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground",
                    isGlassTheme
                      ? "hover:bg-white/38 rounded-xl"
                      : "rounded-md hover:bg-sidebar-accent/50",
                  )}
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
                glass={isGlassTheme}
              />
            )}
            {visibleGroups.map((group) => (
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
                glass={isGlassTheme}
              />
            ))}
          </nav>
        </div>

        <div
          className={cn(
            isGlassTheme
              ? "space-y-1 border-t border-white/40 px-2.5 py-2.5"
              : "space-y-0.5 border-t border-sidebar-border px-2 py-2",
          )}
        >
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
              glass={isGlassTheme}
            />
          ))}
          <div className={cn("pt-2", collapsed && "flex justify-center")}>
            <button
              onClick={handleToggle}
              className={cn(
                "flex w-full items-center justify-center px-3 py-2 text-sidebar-foreground/55 lg:flex",
                isGlassTheme
                  ? "hover:bg-white/42 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:text-sidebar-foreground hover:shadow-[0_18px_38px_rgba(255,255,255,0.34),0_10px_24px_rgba(18,24,30,0.12),inset_0_1px_1px_rgba(255,255,255,0.72)] active:translate-y-0"
                  : "rounded-lg transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
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
