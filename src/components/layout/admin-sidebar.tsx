"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Menu, X, LogOut, LayoutDashboard, CreditCard, Users, FileText, ScrollText, ShieldCheck, Palette } from "lucide-react";
import { adminLogout } from "@/actions/admin";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Dashboard: LayoutDashboard,
  Plans: FileText,
  Payments: CreditCard,
  Tenants: Users,
  Admins: ShieldCheck,
  "Audit Log": ScrollText,
  Branding: Palette,
};

interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

export default function AdminSidebar({
  navItems,
  logoUrl,
  appName,
  admin,
  pendingCount,
}: {
  navItems: NavItem[];
  logoUrl: string;
  appName: string;
  admin: { id: string; name: string; email: string; role: string; avatar: string | null };
  pendingCount: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname() ?? "";

  const items = navItems.map((item) => ({
    ...item,
    badge: item.label === "Payments" ? pendingCount : undefined,
  }));

  function SidebarContent() {
    return (
      <>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/80 px-5">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-11 w-11 rounded-lg bg-white object-contain p-1 shadow-sm" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/25">
              <Shield className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{appName}</p>
            <p className="text-xs font-semibold text-muted-foreground">Super Admin Console</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {items.map((item) => {
            const Icon = iconMap[item.label];
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-zinc-950">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-border/80 p-4">
          <div className="mb-2 flex items-center gap-3 rounded-lg border bg-secondary/60 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {admin.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{admin.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{admin.role.toLowerCase().replace("_", " ")}</p>
            </div>
          </div>
          <form action={adminLogout}>
            <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-white/[0.92] px-4 shadow-sm backdrop-blur-xl lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="-ml-2 rounded-lg border bg-card p-2 shadow-sm hover:bg-secondary" title="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-8 w-8 object-contain rounded" />
          ) : (
            <Shield className="h-5 w-5 text-primary" />
          )}
          <span className="font-semibold text-sm">{appName}</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-72 border-r bg-card shadow-xl transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-end p-2">
          <button onClick={() => setMobileOpen(false)} className="rounded-lg border bg-card p-2 shadow-sm hover:bg-secondary" title="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-72 flex-col border-r border-border/80 bg-card shadow-sm shadow-slate-950/5 lg:flex">
        <SidebarContent />
      </aside>
    </>
  );
}
