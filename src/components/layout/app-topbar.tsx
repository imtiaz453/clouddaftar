"use client";

import { signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect, useCallback, useMemo } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { CSSProperties } from "react";
import {
  Search,
  Bell,
  BellOff,
  LogOut,
  User,
  Settings,
  CreditCard,
  Moon,
  Sun,
  CheckCheck,
  Lock,
  Palette,
  Menu,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/providers/toast-provider";
import {
  NAV_GROUPS,
  PERMISSIONS,
  getEffectiveUserPermissions,
  type NavGroup,
} from "@/lib/constants";
import { applyPlanPermissionLimitsForRole } from "@/lib/plan-features";
interface AppTopbarProps {
  companyName?: string;
  rolePermissions?: Record<string, string[]> | null;
  userPermissionOverrides?: Record<string, unknown> | null;
  planCode?: string | null;
  userRole?: string;
  userName?: string;
  userEmail?: string;
  userImage?: string;
  onMenuClick?: () => void;
}

const dashboardRoutes = [
  "/",
  "/inventory",
  "/expenses",
  "/employees",
  "/payroll",
  "/accounting",
  "/sales",
  "/purchases",
  "/customers",
  "/suppliers",
  "/reports",
  "/settings",
  "/users",
  "/profile",
  "/audit-log",
  "/billing",
  "/accounts-receivable",
  "/accounts-payable",
  "/reconciliation",
  "/payment-reminders",
  "/accounting-reports",
  "/customer-payments",
  "/supplier-payments",
  "/quotations",
  "/income-expense",
  "/cash-flow",
  "/help",
  "/apps",
];

const MODULE_MENU_GROUPS = new Set([
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

const moduleGlowColors: Record<string, string> = {
  POS: "37 99 235",
  Sales: "37 99 235",
  Purchases: "239 68 68",
  Inventory: "124 58 237",
  Contacts: "37 99 235",
  Accounting: "124 58 237",
  Expenses: "239 68 68",
  Employees: "124 58 237",
  Reports: "37 99 235",
  Administration: "124 58 237",
};

function moduleGlowStyle(label: string): CSSProperties {
  return { "--menu-glow": moduleGlowColors[label] || "37 99 235" } as CSSProperties;
}

const ALL_PERMISSION_VALUES = new Set(Object.values(PERMISSIONS));
const NOTIFICATION_CACHE_KEY = "cloud-daftar-navbar-notifications";
const NOTIFICATION_CACHE_MS = 30 * 1000;

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

function hasAnyPermission(itemPerms: string[] | undefined, userPerms: string[]): boolean {
  if (!itemPerms || itemPerms.length === 0) return true;
  const userSet = new Set(userPerms);
  return itemPerms.some((key) => {
    const permValue = (PERMISSIONS as Record<string, string>)[key];
    return permValue && userSet.has(permValue);
  });
}

function filterModuleMenus(groups: NavGroup[], permissions: string[]): NavGroup[] {
  const allowedAll = permissions.length === 0 || permissions.length >= ALL_PERMISSION_VALUES.size;
  return groups
    .filter((group) => MODULE_MENU_GROUPS.has(group.label))
    .map((group) => ({
      ...group,
      items: allowedAll
        ? group.items
        : group.items.filter((item) => hasAnyPermission(item.permissions, permissions)),
    }))
    .filter((group) => group.items.length > 0);
}

export function AppTopbar({
  companyName,
  rolePermissions,
  userPermissionOverrides,
  planCode,
  userRole = "",
  userName = "User",
  userEmail = "",
  userImage = "",
  onMenuClick,
}: AppTopbarProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { addToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const segments = pathname.split("/").filter(Boolean);
  const tenant =
    segments.length >= 2 && !dashboardRoutes.includes("/" + segments[0]) ? segments[0] : null;

  function tenantHref(href: string) {
    return tenant ? `/${tenant}${href === "/" ? "" : href}` : href;
  }

  const moduleMenus = useMemo(() => {
    const permissions = applyPlanPermissionLimitsForRole(
      getEffectiveUserPermissions(userRole, rolePermissions, userPermissionOverrides),
      planCode,
      userRole,
    );
    return filterModuleMenus(NAV_GROUPS, permissions);
  }, [userRole, rolePermissions, userPermissionOverrides, planCode]);

  const searchItems = useMemo(
    () =>
      moduleMenus.flatMap((group) =>
        group.items.map((item) => ({ ...item, group: group.label })),
      ),
    [moduleMenus],
  );

  const activeModuleLabel = useMemo(() => {
    const currentPath = tenant && pathname.startsWith(`/${tenant}/`)
      ? pathname.slice(tenant.length + 1) || "/"
      : pathname;

    return (
      moduleMenus.find((group) =>
        group.items.some((item) => {
          const href = item.href.split("?")[0];
          return currentPath === href || currentPath.startsWith(`${href}/`);
        }),
      )?.label ?? null
    );
  }, [moduleMenus, pathname, tenant]);

  const filteredSearchItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return searchItems.slice(0, 12);
    return searchItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.group.toLowerCase().includes(query) ||
          item.href.toLowerCase().includes(query),
      )
      .slice(0, 12);
  }, [searchItems, searchQuery]);

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "CD";

  const fetchNotifications = useCallback(async () => {
    try {
      const cached = window.sessionStorage.getItem(NOTIFICATION_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - Number(parsed.createdAt || 0) < NOTIFICATION_CACHE_MS) {
          setNotifications(parsed.notifications ?? []);
          setUnreadCount(parsed.unreadCount ?? 0);
          return;
        }
      }
    } catch {}

    setNotifLoading(true);
    try {
      const res = await fetch("/api/notifications?unreadOnly=true&pageSize=10");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setNotifications(json.data?.data ?? []);
          setUnreadCount(json.data?.unreadCount ?? 0);
          try {
            window.sessionStorage.setItem(
              NOTIFICATION_CACHE_KEY,
              JSON.stringify({
                createdAt: Date.now(),
                notifications: json.data?.data ?? [],
                unreadCount: json.data?.unreadCount ?? 0,
              }),
            );
          } catch {}
        }
      }
    } catch {
      // silent
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const initialTimer = window.setTimeout(fetchNotifications, 5000);
    const interval = window.setInterval(fetchNotifications, 60000);
    const refresh = () => {
      window.sessionStorage.removeItem(NOTIFICATION_CACHE_KEY);
      fetchNotifications();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("notifications:refresh", refresh);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("notifications:refresh", refresh);
    };
  }, [fetchNotifications, mounted]);

  useEffect(() => {
    if (notifOpen) fetchNotifications();
  }, [notifOpen, fetchNotifications]);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (event.key === "Escape") setSearchOpen(false);
      if (!isTyping && event.key === "/" && !searchOpen) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, searchOpen]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications([]);
      setUnreadCount(0);
      window.dispatchEvent(new Event("notifications:refresh"));
    } catch {
      addToast({ title: "Could not mark notifications as read", variant: "error" });
    }
  }

  async function markRead(id: string, link?: string | null) {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (link) router.push(tenantHref(link));
    } catch {
      // silent
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/95 sm:px-5">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => router.push(tenantHref("/apps"))}
          className="hidden h-9 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden md:inline">Apps</span>
        </button>

        {mounted && (
          <div className="relative hidden w-56 shrink-0 md:block lg:w-64 xl:w-72">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="topbar-glass-search flex h-9 w-full items-center gap-2 rounded-lg border border-border/80 bg-card/80 px-3 text-left text-sm text-muted-foreground shadow-sm transition hover:border-primary/30 hover:bg-card"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">Search screens and actions…</span>
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {moduleMenus.length > 0 && mounted && (
          <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
            <div className="topbar-glass-menu-shell flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl p-1.5">
              {moduleMenus.map((group) => {
                const active = group.label === activeModuleLabel;
                return (
                  <DropdownMenu key={group.label}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        style={moduleGlowStyle(group.label)}
                        className={`topbar-glass-menu-button h-9 shrink-0 gap-1.5 rounded-xl border px-3 text-sm transition-all duration-200 ${
                          active
                            ? "is-active border-primary/30 bg-primary/10 text-foreground shadow-sm"
                            : "border-border/70 bg-card/50 text-muted-foreground hover:border-primary/30 hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {group.label}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      style={moduleGlowStyle(group.label)}
                      className="topbar-glass-menu-content w-64 border-border bg-popover p-2 shadow-md"
                    >
                      {group.items.map((item) => (
                        <DropdownMenuItem
                          key={item.href}
                          onClick={() => router.push(tenantHref(item.href))}
                          className="topbar-glass-menu-item py-2.5 text-sm transition-colors"
                        >
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {mounted ? (
            <>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>

              <button
                onClick={() => {
                  const next = theme === "dark" ? "light" : "dark";
                  setTheme(next);
                  localStorage.setItem("theme-preference", next);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Notifications"
                  >
                    {unreadCount > 0 ? (
                      <>
                        <Bell className="h-5 w-5" />
                        <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      </>
                    ) : (
                      <BellOff className="h-5 w-5" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80" align="end">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <CheckCheck className="h-3 w-3" />
                        Mark all read
                      </button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner size={5} />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No new notifications</div>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className="flex cursor-pointer flex-col items-start gap-0.5 py-2.5"
                        onClick={() => markRead(n.id, n.link)}
                      >
                        <span className="text-sm font-medium">{n.title}</span>
                        {n.message && (
                          <span className="text-xs text-muted-foreground">{n.message}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="justify-center text-xs text-muted-foreground"
                    onClick={() => router.push(tenantHref("/notifications"))}
                  >
                    View all
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="rounded-full">
                    <Avatar className="h-8 w-8 ring-2 ring-border">
                      <AvatarImage src={userImage} alt={userName} />
                      <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">{userName}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {userEmail}
                      </span>
                      {companyName && (
                        <span className="text-xs text-muted-foreground">{companyName}</span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(tenantHref("/profile"))}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(tenantHref("/settings"))}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(tenantHref("/billing"))}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(tenantHref("/settings?tab=theme"))}>
                    <Palette className="mr-2 h-4 w-4" />
                    Theme
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(tenantHref("/profile"))}>
                    <Lock className="mr-2 h-4 w-4" />
                    Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLogoutConfirmOpen(true)}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          )}
        </div>
      </header>

      {searchOpen && mounted && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border/80 bg-popover shadow-panel-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Jump to a screen…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setSearchOpen(false)}
              >
                Esc
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredSearchItems.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matches</p>
              ) : (
                filteredSearchItems.map((item) => (
                  <button
                    key={`${item.group}-${item.href}`}
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                      router.push(tenantHref(item.href));
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <span>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.group}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
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
