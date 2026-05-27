"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
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
  Loader2,
  CheckCheck,
  Lock,
  Palette,
  ChevronDown,
  Layers,
  Building2,
  Command,
  X,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/providers/toast-provider";
import {
  NAV_GROUPS,
  PERMISSIONS,
  getEffectiveUserPermissions,
  type NavGroup,
} from "@/lib/constants";
import { applyPlanPermissionLimitsForRole } from "@/lib/plan-features";

interface NavbarProps {
  companyName?: string;
  companyLogo?: string | null;
  hideMenuButton?: boolean;
  showModuleMenus?: boolean;
  rolePermissions?: Record<string, string[]> | null;
  userPermissionOverrides?: Record<string, unknown> | null;
  planCode?: string | null;
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
  const allowedAll = permissions.length === 0 || permissions.length >= ALL_PERMISSION_VALUES.size;

  return groups
    .filter((group) => MODULE_MENU_GROUPS.has(group.label))
    .map((group) => ({
      ...group,
      label: group.label === "Administration" ? "Settings" : group.label,
      items: allowedAll
        ? group.items
        : group.items.filter((item) => hasAnyPermission(item.permissions, permissions)),
    }))
    .filter((group) => group.items.length > 0);
}

export function Navbar({
  companyName,
  companyLogo,
  hideMenuButton,
  showModuleMenus,
  rolePermissions,
  userPermissionOverrides,
  planCode,
}: NavbarProps) {
  const { data: session } = useSession();
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
    const role = (session?.user as { role?: string })?.role || "";

    const permissions = applyPlanPermissionLimitsForRole(
      getEffectiveUserPermissions(role, rolePermissions, userPermissionOverrides),
      planCode,
      role,
    );

    return filterModuleMenus(NAV_GROUPS, permissions);
  }, [session, rolePermissions, userPermissionOverrides, planCode]);

  const searchItems = useMemo(
    () =>
      moduleMenus.flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          group: group.label,
        })),
      ),
    [moduleMenus],
  );

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

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((namePart) => namePart[0])
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
    } catch {
      // Ignore cache errors.
    }

    setNotifLoading(true);

    try {
      const res = await fetch("/api/notifications?unreadOnly=true&pageSize=10");

      if (res.ok) {
        const json = await res.json();

        if (json.success) {
          const nextNotifications = json.data?.data ?? [];
          const nextUnreadCount = json.data?.unreadCount ?? 0;

          setNotifications(nextNotifications);
          setUnreadCount(nextUnreadCount);

          try {
            window.sessionStorage.setItem(
              NOTIFICATION_CACHE_KEY,
              JSON.stringify({
                createdAt: Date.now(),
                notifications: nextNotifications,
                unreadCount: nextUnreadCount,
              }),
            );
          } catch {
            // Ignore cache write errors.
          }
        }
      }
    } catch {
      // Silent fail.
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const initialTimer = window.setTimeout(fetchNotifications, 5000);
    const interval = window.setInterval(fetchNotifications, 60000);

    const refresh = () => {
      window.sessionStorage.removeItem(NOTIFICATION_CACHE_KEY);
      fetchNotifications();
    };

    const refreshWhenVisible = () => {
      if (!document.hidden) fetchNotifications();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("notifications:refresh", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("notifications:refresh", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
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
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        return;
      }

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
      addToast({ title: "Error marking notifications as read", variant: "error" });
    }
  }

  async function markRead(id: string, link?: string | null) {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      window.dispatchEvent(new Event("notifications:refresh"));

      if (link) router.push(tenantHref(link));
    } catch {
      // Silent fail.
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;

    const hours = Math.floor(mins / 60);

    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);

    return `${days}d ago`;
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 text-slate-950 shadow-sm shadow-slate-950/[0.03] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 dark:border-slate-800/80 dark:bg-slate-950/80 dark:text-slate-50">
        <div className="flex h-16 items-center gap-2 px-3 sm:px-4 lg:px-6">
          {!hideMenuButton && (
            <button
              type="button"
              onClick={() => router.push(tenantHref("/apps"))}
              className="group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-primary/10"
              aria-label="Open apps"
              title="Apps"
            >
              <Layers className="h-5 w-5 transition-transform group-hover:scale-110" />
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push(tenantHref("/"))}
            className="flex min-w-0 shrink-0 items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
            title={companyName || "Cloud Daftar"}
          >
            {companyLogo ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <img src={companyLogo} alt="Logo" className="h-7 w-7 rounded-xl object-contain" />
              </span>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-950 to-slate-700 text-xs font-black text-white shadow-lg shadow-slate-950/20 dark:from-white dark:to-slate-300 dark:text-slate-950">
                CD
              </span>
            )}

            <span className="hidden min-w-0 flex-col text-left sm:flex">
              <span className="max-w-[10rem] truncate text-sm font-black tracking-tight lg:max-w-[15rem]">
                {companyName || "Cloud Daftar"}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <Sparkles className="h-3 w-3" />
                Business Workspace
              </span>
            </span>
          </button>

          {mounted && showModuleMenus && (
            <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 xl:flex">
              {moduleMenus.map((group) => (
                <DropdownMenu key={group.label}>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-950 data-[state=open]:bg-slate-950 data-[state=open]:text-white dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white dark:data-[state=open]:bg-white dark:data-[state=open]:text-slate-950">
                      {group.label}
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="start"
                    className="w-64 rounded-2xl border-slate-200 p-2 shadow-xl shadow-slate-950/10 dark:border-slate-800"
                  >
                    <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-extrabold">{group.label}</span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {group.items.length} screen{group.items.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <div className="max-h-[22rem] overflow-y-auto py-1">
                      {group.items.map((item) => (
                        <DropdownMenuItem
                          key={item.href}
                          onClick={() => router.push(tenantHref(item.href))}
                          className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold"
                        >
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </nav>
          )}

          {mounted && showModuleMenus && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 xl:hidden">
                  Modules
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                className="max-h-[75vh] w-72 overflow-y-auto rounded-2xl p-2 shadow-xl"
              >
                {moduleMenus.map((group) => (
                  <div key={group.label}>
                    <DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>

                    {group.items.map((item) => (
                      <DropdownMenuItem
                        key={item.href}
                        onClick={() => router.push(tenantHref(item.href))}
                        className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold"
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {mounted && showModuleMenus && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="ml-auto hidden h-10 min-w-[17rem] max-w-md flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-3 text-left text-sm text-slate-500 shadow-inner transition-all hover:border-primary/40 hover:bg-white hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:bg-slate-900 lg:flex"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">Search modules, reports, actions...</span>
              <kbd className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                Ctrl K
              </kbd>
            </button>
          )}

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            {mounted && showModuleMenus && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 lg:hidden"
                aria-label="Search"
                title="Search"
              >
                <Search className="h-5 w-5" />
              </button>
            )}

            {!mounted ? (
              <>
                <button
                  type="button"
                  className="h-10 w-10 rounded-2xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  aria-label="Theme"
                  disabled
                  title="Toggle theme"
                >
                  <Moon className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  className="relative h-10 w-10 rounded-2xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  aria-label="Notifications"
                  disabled
                  title="Notifications"
                >
                  <BellOff className="h-5 w-5" />
                </button>

                <Button variant="ghost" className="relative h-10 w-10 rounded-2xl" disabled>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">CD</AvatarFallback>
                  </Avatar>
                </Button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const next = theme === "dark" ? "light" : "dark";
                    setTheme(next);
                    localStorage.setItem("theme-preference", next);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                  title="Toggle theme"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>

                <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                      title="Notifications"
                      aria-label="Notifications"
                    >
                      {unreadCount > 0 ? (
                        <>
                          <Bell className="h-5 w-5" />
                          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-black text-white dark:border-slate-950">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        </>
                      ) : (
                        <BellOff className="h-5 w-5" />
                      )}
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    className="w-86 max-w-[calc(100vw-1rem)] rounded-2xl p-2 shadow-xl sm:w-96"
                    align="end"
                  >
                    <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        <span className="block text-sm font-black">Notifications</span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {unreadCount > 0 ? `${unreadCount} unread update(s)` : "All caught up"}
                        </span>
                      </span>

                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Mark read
                        </button>
                      )}
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    {notifLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900">
                          <BellOff className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-semibold">No new notifications</p>
                        <p className="text-xs text-muted-foreground">You are up to date.</p>
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto py-1">
                        {notifications.slice(0, 5).map((notification) => (
                          <DropdownMenuItem
                            key={notification.id}
                            className="flex cursor-pointer flex-col items-start gap-1 rounded-xl px-3 py-3"
                            onClick={() => markRead(notification.id, notification.link)}
                          >
                            <div className="flex w-full items-start gap-2">
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold">
                                  {notification.title}
                                </span>

                                {notification.message && (
                                  <span className="line-clamp-2 text-xs text-muted-foreground">
                                    {notification.message}
                                  </span>
                                )}

                                <span className="mt-1 block text-[10px] font-semibold text-muted-foreground">
                                  {timeAgo(notification.createdAt)}
                                </span>
                              </span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="cursor-pointer justify-center rounded-xl py-2 text-xs font-bold text-muted-foreground"
                      onClick={() => router.push(tenantHref("/notifications"))}
                    >
                      View all notifications
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 rounded-2xl border border-slate-200 bg-white px-1.5 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={session?.user?.image || ""}
                          alt={session?.user?.name || "User"}
                        />
                        <AvatarFallback className="bg-slate-950 text-xs font-black text-white dark:bg-white dark:text-slate-950">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="w-72 rounded-2xl p-2 shadow-xl" align="end">
                    <DropdownMenuLabel className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={session?.user?.image || ""}
                            alt={session?.user?.name || "User"}
                          />
                          <AvatarFallback className="bg-slate-950 text-xs font-black text-white dark:bg-white dark:text-slate-950">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <span className="block truncate text-sm font-black">
                            {session?.user?.name || "User"}
                          </span>
                          <span className="block truncate text-xs font-normal text-muted-foreground">
                            {session?.user?.email}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => router.push(tenantHref("/profile"))}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => router.push(tenantHref("/settings"))}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Company Settings
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => router.push(tenantHref("/billing"))}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing & Subscription
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => router.push(tenantHref("/profile"))}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Change Password
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => router.push(tenantHref("/settings?tab=theme"))}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <Palette className="mr-2 h-4 w-4" />
                      Theme
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => setLogoutConfirmOpen(true)}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-red-600 focus:text-red-600 dark:text-red-400"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </header>

      {mounted && searchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          />

          <div className="relative mx-auto mt-12 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl shadow-slate-950/30 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Command className="h-5 w-5" />
              </div>

              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search invoices, inventory, reports, settings..."
                className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
              />

              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-900"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[26rem] overflow-y-auto p-2">
              {filteredSearchItems.length === 0 ? (
                <div className="px-3 py-12 text-center">
                  <p className="text-sm font-bold">No matching screens found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try searching sales, inventory, reports, customers, or settings.
                  </p>
                </div>
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
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{item.label}</span>
                      <span className="block truncate text-xs font-semibold text-muted-foreground">
                        {item.group}
                      </span>
                    </span>

                    <span className="hidden shrink-0 rounded-xl bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-muted-foreground dark:bg-slate-900 sm:block">
                      {item.href}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-[11px] font-semibold text-muted-foreground dark:border-slate-800">
              <span>Press Enter by clicking a result</span>
              <span>Esc to close</span>
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