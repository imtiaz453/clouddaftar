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
  Menu,
  X,
  Building2,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    } catch {
      // ignore cache error
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
            // ignore cache write error
          }
        }
      }
    } catch {
      // silent fail
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
        setMobileMenuOpen(false);
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

  useEffect(() => {
    function closeMobileOnResize() {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("resize", closeMobileOnResize);

    return () => window.removeEventListener("resize", closeMobileOnResize);
  }, []);

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

      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      window.dispatchEvent(new Event("notifications:refresh"));

      if (link) router.push(tenantHref(link));
    } catch {
      // silent fail
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

  function navigateTo(href: string) {
    setMobileMenuOpen(false);
    router.push(tenantHref(href));
  }

  return (
    <>
      <header className="fixed left-1/2 top-2 z-40 h-16 w-[95vw] min-w-[320px] max-w-[1440px] -translate-x-1/2 rounded-full border border-white/30 bg-slate-950/70 px-3 text-white shadow-[0_10px_25px_-12px_rgba(0,0,0,0.75)] ring-2 ring-white/20 backdrop-blur-md dark:bg-slate-950/80">
        <div className="relative flex h-full items-center gap-2">
          {!hideMenuButton && (
            <button
              type="button"
              onClick={() => navigateTo("/apps")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-sm transition hover:bg-white/20"
              aria-label="Open apps"
              title="Apps"
            >
              <Layers className="h-5 w-5" />
            </button>
          )}

          {mounted && showModuleMenus && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-sm transition hover:bg-white/20 md:hidden"
              aria-label="Toggle menu"
              title="Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => navigateTo("/")}
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/30 bg-white/15 py-1 pl-1 pr-4 shadow-sm transition hover:bg-white/20 md:static md:left-auto md:translate-x-0"
            title={companyName || "Cloud Daftar"}
          >
            <span className="brand__icon flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/30 shadow">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo" className="h-8 w-8 rounded-full object-contain" />
              ) : (
                <Building2 className="h-5 w-5 text-white" />
              )}
            </span>

            <span className="max-w-[8rem] truncate text-sm font-black tracking-tight text-white sm:max-w-[12rem]">
              {companyName || "Cloud Daftar"}
            </span>
          </button>

          {mounted && showModuleMenus && (
            <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
              {moduleMenus.slice(0, 8).map((group) => (
                <DropdownMenu key={group.label}>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-bold text-white/85 transition hover:bg-emerald-200 hover:text-slate-950 data-[state=open]:bg-emerald-200 data-[state=open]:text-slate-950 lg:px-4">
                      {group.label}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="center"
                    className="w-64 rounded-2xl border-white/20 bg-white/95 p-2 shadow-xl backdrop-blur dark:bg-slate-950/95"
                  >
                    <DropdownMenuLabel className="px-3 py-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <div className="max-h-[22rem] overflow-y-auto">
                      {group.items.map((item) => (
                        <DropdownMenuItem
                          key={item.href}
                          onClick={() => navigateTo(item.href)}
                          className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
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

          <div className="ml-auto flex items-center gap-2">
            {mounted && showModuleMenus && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="hidden h-10 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white/80 shadow-sm transition hover:bg-white/20 hover:text-white lg:flex"
                aria-label="Search"
                title="Search"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
                <kbd className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-black text-white/80">
                  Ctrl K
                </kbd>
              </button>
            )}

            {mounted && showModuleMenus && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-sm transition hover:bg-white/20 lg:hidden"
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
                  className="h-10 w-10 rounded-full border border-white/20 bg-white/10 p-2 text-white/70"
                  disabled
                  aria-label="Theme"
                  title="Toggle theme"
                >
                  <Moon className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  className="relative h-10 w-10 rounded-full border border-white/20 bg-white/10 p-2 text-white/70"
                  disabled
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <BellOff className="h-5 w-5" />
                </button>

                <Button variant="ghost" className="relative h-10 w-10 rounded-full" disabled>
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
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-sm transition hover:bg-white/20"
                  title="Toggle theme"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>

                <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-sm transition hover:bg-white/20"
                      title="Notifications"
                      aria-label="Notifications"
                    >
                      {unreadCount > 0 ? (
                        <>
                          <Bell className="h-5 w-5" />
                          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-red-500 px-1 text-[10px] font-black text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        </>
                      ) : (
                        <BellOff className="h-5 w-5" />
                      )}
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="w-[22rem] rounded-2xl p-2 shadow-xl" align="end">
                    <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        <span className="block text-sm font-black">Notifications</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                        </span>
                      </span>

                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
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
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No new notifications
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto py-1">
                        {notifications.slice(0, 5).map((n) => (
                          <DropdownMenuItem
                            key={n.id}
                            className="flex cursor-pointer flex-col items-start gap-1 rounded-xl px-3 py-3"
                            onClick={() => markRead(n.id, n.link)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                              <span className="text-sm font-bold">{n.title}</span>
                            </div>

                            {n.message && (
                              <span className="pl-4 text-xs text-muted-foreground">
                                {n.message}
                              </span>
                            )}

                            <span className="pl-4 text-[10px] font-semibold text-muted-foreground">
                              {timeAgo(n.createdAt)}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="cursor-pointer justify-center rounded-xl py-2 text-xs font-bold text-muted-foreground"
                      onClick={() => navigateTo("/notifications")}
                    >
                      View all notifications
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 rounded-full border border-white/20 bg-white/10 px-1.5 text-white shadow-sm hover:bg-white/20"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={session?.user?.image || ""}
                          alt={session?.user?.name || "User"}
                        />
                        <AvatarFallback className="bg-white text-xs font-black text-slate-950">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="hidden h-3.5 w-3.5 text-white/80 sm:block" />
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
                          <AvatarFallback className="bg-slate-950 text-xs font-black text-white">
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
                      onClick={() => navigateTo("/profile")}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigateTo("/settings")}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Company Settings
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigateTo("/billing")}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing & Subscription
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigateTo("/profile")}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Change Password
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigateTo("/settings?tab=theme")}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-semibold"
                    >
                      <Palette className="mr-2 h-4 w-4" />
                      Theme
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => setLogoutConfirmOpen(true)}
                      className="cursor-pointer rounded-xl px-3 py-2.5 font-bold text-red-600 focus:text-red-600"
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

        {mounted && showModuleMenus && mobileMenuOpen && (
          <div className="absolute left-0 right-0 top-[4.75rem] mx-auto w-[92vw] max-w-md overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950/85 p-3 text-white shadow-2xl backdrop-blur-xl md:hidden">
            <div className="max-h-[70vh] overflow-y-auto">
              {moduleMenus.map((group) => (
                <div key={group.label} className="py-2">
                  <div className="px-3 pb-2 text-xs font-black uppercase tracking-wide text-white/50">
                    {group.label}
                  </div>

                  <div className="grid gap-1">
                    {group.items.map((item) => (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => navigateTo(item.href)}
                        className="rounded-full px-4 py-2.5 text-left text-sm font-bold text-white/85 transition hover:bg-emerald-200 hover:text-slate-950"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {mounted && searchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          />

          <div className="relative mx-auto mt-20 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Search className="h-5 w-5 text-muted-foreground" />

              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search modules, reports, actions..."
                className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
              />

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
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
                      navigateTo(item.href);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{item.label}</span>
                      <span className="block truncate text-xs font-semibold text-muted-foreground">
                        {item.group}
                      </span>
                    </span>

                    <span className="hidden shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground sm:block">
                      {item.href}
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