"use client";

import { signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect, useCallback, useMemo } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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
  ArrowRight,
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
import { EnableNotifications } from "@/components/shared/enable-notifications";
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
  const allowedAll = permissions.length >= ALL_PERMISSION_VALUES.size;
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
  const [openModuleMenu, setOpenModuleMenu] = useState<string | null>(null);

  const segments = pathname.split("/").filter(Boolean);
  const tenant =
    segments.length >= 2 && !dashboardRoutes.includes("/" + segments[0]) ? segments[0] : null;

  function tenantHref(href: string) {
    return tenant ? `/${tenant}${href === "/" ? "" : href}` : href;
  }

  function navigateTo(href: string) {
    setOpenModuleMenu(null);
    setNotifOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
    router.push(tenantHref(href));
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
      if (link) navigateTo(link);
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
      <header className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center gap-3 border-b border-border/70 bg-background/98 px-4 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/95 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => navigateTo("/apps")}
          className="hidden h-11 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-bold text-background shadow-sm transition hover:opacity-90 sm:inline-flex"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden md:inline">Apps</span><ArrowRight className="hidden h-4 w-4 md:inline" />
        </button>

        {mounted && (
          <div className="relative hidden w-56 shrink-0 md:block lg:w-64 xl:w-72">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-11 w-full items-center gap-2 rounded-full border border-border/80 bg-card/90 px-4 text-left text-sm text-muted-foreground shadow-sm transition hover:border-primary/30 hover:bg-card"
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
          <nav className="hidden min-w-0 flex-1 items-center justify-center lg:flex" aria-label="Main modules">
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-transparent p-1">
              {moduleMenus.map((group) => {
                const active = group.label === activeModuleLabel;
                const featuredItems = group.items.slice(0, 6);
                const moreItems = group.items.slice(6, 14);
                return (
                  <DropdownMenu
                    key={group.label}
                    open={openModuleMenu === group.label}
                    onOpenChange={(open) => setOpenModuleMenu(open ? group.label : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold tracking-tight transition-colors ${
                          active
                            ? "bg-foreground text-background"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {group.label}
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      sideOffset={14}
                      className="w-[min(760px,calc(100vw-3rem))] overflow-hidden rounded-[1.75rem] border border-border/70 bg-background p-0 shadow-2xl"
                    >
                      <div className="grid gap-0 md:grid-cols-[1.15fr_.85fr]">
                        <div className="p-5 sm:p-6">
                          <div className="mb-4 text-sm font-bold text-muted-foreground">
                            Cloud Daftar for {group.label}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {featuredItems.map((item) => (
                              <button
                                key={item.href}
                                type="button"
                                onClick={() => navigateTo(item.href)}
                                className="group flex items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-muted"
                              >
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                                  <LayoutGrid className="h-5 w-5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-bold text-foreground">
                                    {item.label}
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    Open {group.label.toLowerCase()} screen
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                          {moreItems.length > 0 && (
                            <div className="mt-4 grid gap-1 border-t border-border/70 pt-4 sm:grid-cols-2">
                              {moreItems.map((item) => (
                                <button
                                  key={item.href}
                                  type="button"
                                  onClick={() => navigateTo(item.href)}
                                  className="flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                  <span className="truncate">{item.label}</span>
                                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="hidden border-l border-border/70 bg-muted/45 p-6 md:block">
                          <div className="rounded-3xl border border-border/70 bg-background p-4 shadow-sm">
                            <div className="mb-4 flex h-32 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 via-muted to-primary/5">
                              <LayoutGrid className="h-12 w-12 text-primary" />
                            </div>
                            <div className="text-base font-black text-foreground">
                              Work faster in {group.label}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              Quick access to daily operations, reports, and related module tools.
                            </p>
                            <button
                              type="button"
                              onClick={() => navigateTo(featuredItems[0]?.href || "/apps")}
                              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
                            >
                              Open module
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {mounted ? (
            <>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-all hover:border-border hover:bg-card hover:text-foreground hover:shadow-sm"
                    title="Notifications"
                    aria-label="Notifications"
                  >
                    {unreadCount > 0 ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                    {unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-background bg-destructive px-1.5 text-[10px] font-black leading-none text-destructive-foreground shadow-sm">
                        {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  className="w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-border bg-popover p-0 shadow-xl sm:w-[360px]"
                >
                  <div className="border-b border-border bg-popover px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                          <Bell className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <DropdownMenuLabel className="truncate p-0 text-sm font-bold tracking-tight">
                            Notifications
                          </DropdownMenuLabel>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} unread` : "No unread notifications"}
                          </p>
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Read all
                        </button>
                      )}
                    </div>
                    <div className="mt-2 [&_*]:max-w-full [&_button]:!h-8 [&_button]:!rounded-lg [&_button]:!px-2.5 [&_button]:!text-[11px]">
                      <EnableNotifications />
                    </div>
                  </div>

                  <div className="max-h-[340px] overflow-y-auto p-1.5">
                    {notifLoading ? (
                      <div className="flex justify-center py-10">
                        <LoadingSpinner size={5} />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-7 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-border">
                          <BellOff className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">No new notifications</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Alerts and approvals will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {notifications.slice(0, 6).map((n) => (
                          <DropdownMenuItem
                            key={n.id}
                            className="group flex cursor-pointer items-start gap-2.5 whitespace-normal rounded-xl border border-transparent p-2.5 outline-none transition-colors focus:bg-muted hover:bg-muted"
                            onClick={() => markRead(n.id, n.link)}
                          >
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-1 block text-sm font-semibold leading-5 text-foreground">
                                {n.title}
                              </span>
                              {n.message && (
                                <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                                  {n.message}
                                </span>
                              )}
                              <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {timeAgo(n.createdAt)}
                              </span>
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border bg-popover p-1.5">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => navigateTo("/notifications")}
                    >
                      View all
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                  <DropdownMenuItem onClick={() => navigateTo("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigateTo("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigateTo("/billing")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigateTo("/settings?tab=theme")}>
                    <Palette className="mr-2 h-4 w-4" />
                    Theme
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigateTo("/profile")}>
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
                    onClick={() => navigateTo(item.href)}
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
