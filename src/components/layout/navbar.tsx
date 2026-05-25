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
    if (!query) return searchItems.slice(0, 10);
    return searchItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.group.toLowerCase().includes(query) ||
          item.href.toLowerCase().includes(query),
      )
      .slice(0, 10);
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
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/90 px-2 text-foreground shadow-sm shadow-slate-950/[0.04] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 dark:bg-background/80 sm:px-4">
      {!hideMenuButton && (
        <button
          type="button"
          onClick={() => router.push(tenantHref("/apps"))}
          className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          aria-label="Open apps"
          title="Apps"
        >
          <Layers className="h-5 w-5" />
        </button>
      )}

      <button
        type="button"
        onClick={() => router.push(tenantHref("/"))}
        className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-secondary"
      >
        {companyLogo ? (
          <img src={companyLogo} alt="Logo" className="h-7 w-7 rounded-md object-contain" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-xs font-black text-white shadow-sm shadow-primary/25">
            CD
          </span>
        )}
        <span className="min-w-0 max-w-[7rem] truncate text-sm font-extrabold sm:max-w-[14rem]">
          {companyName || "Cloud Daftar"}
        </span>
      </button>

      {mounted && showModuleMenus && (
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex">
          {moduleMenus.map((group) => (
            <DropdownMenu key={group.label}>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-zinc-950 data-[state=open]:text-white">
                  {group.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {group.items.map((item) => (
                  <DropdownMenuItem
                    key={item.href}
                    onClick={() => router.push(tenantHref(item.href))}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </nav>
      )}

      {mounted && showModuleMenus && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-10 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm font-bold text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground md:hidden">
              Modules
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[70vh] w-64 overflow-y-auto">
            {moduleMenus.map((group) => (
              <div key={group.label}>
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                {group.items.map((item) => (
                  <DropdownMenuItem
                    key={item.href}
                    onClick={() => router.push(tenantHref(item.href))}
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
        <div className="relative hidden min-w-[15rem] max-w-md flex-1 lg:block">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate">Search modules, reports, actions...</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
              Ctrl K
            </kbd>
          </button>
          {searchOpen && (
            <div className="absolute right-0 top-11 z-50 w-[30rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border bg-popover shadow-xl">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Find invoices, inventory, reports, settings..."
                  className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchOpen(false)}
                >
                  Esc
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {filteredSearchItems.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No matching screens found
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
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
                    >
                      <span>
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="text-xs text-muted-foreground">{item.group}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{item.href}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {!mounted ? (
          <>
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground"
              aria-label="Theme"
              disabled
              title="Toggle theme"
            >
              <Moon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="relative rounded-lg p-2 text-muted-foreground"
              aria-label="Notifications"
              disabled
              title="Notifications"
            >
              <BellOff className="h-5 w-5" />
            </button>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full" disabled>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">CD</AvatarFallback>
              </Avatar>
            </Button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
                localStorage.setItem("theme-preference", next);
              }}
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  title="Notifications"
                >
                  {unreadCount > 0 ? (
                    <>
                      <Bell className="h-5 w-5" />
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
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
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No new notifications
                  </div>
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <DropdownMenuItem
                      key={n.id}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
                      onClick={() => markRead(n.id, n.link)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="text-sm font-medium">{n.title}</span>
                      </div>
                      {n.message && (
                        <span className="pl-4 text-xs text-muted-foreground">{n.message}</span>
                      )}
                      <span className="pl-4 text-[10px] text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="justify-center text-xs text-muted-foreground"
                  onClick={() => router.push(tenantHref("/notifications"))}
                >
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{session?.user?.name || "User"}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {session?.user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(tenantHref("/profile"))}>
                  <User className="mr-2 h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(tenantHref("/settings"))}>
                  <Settings className="mr-2 h-4 w-4" />
                  Company Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(tenantHref("/billing"))}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Billing & Subscription
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(tenantHref("/profile"))}>
                  <Lock className="mr-2 h-4 w-4" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(tenantHref("/settings?tab=theme"))}>
                  <Palette className="mr-2 h-4 w-4" />
                  Theme
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLogoutConfirmOpen(true)}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
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
    </header>
  );
}
