"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Banknote,
  BookOpen,
  Building2,
  FileText,
  LayoutGrid,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Search,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { dashboardHref } from "@/lib/dashboard-href";
import { PERMISSIONS, getEffectiveUserPermissions } from "@/lib/constants";
import { applyPlanPermissionLimitsForRole } from "@/lib/plan-features";
import { cn } from "@/lib/utils";

const apps = [
  {
    title: "POS",
    category: "Sell",
    description: "Fast checkout",
    href: "/sales/new",
    icon: ShoppingCart,
    accent: "from-rose-500 to-orange-500",
    tint: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/20",
    permissions: ["SALES_CREATE"],
  },
  {
    title: "Sales",
    category: "Sell",
    description: "Invoices & returns",
    href: "/sales",
    icon: FileText,
    accent: "from-cyan-500 to-blue-600",
    tint: "bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-500/20",
    permissions: ["SALES_VIEW"],
  },
  {
    title: "Purchases",
    category: "Buy",
    description: "Orders & supplier bills",
    href: "/purchases",
    icon: Truck,
    accent: "from-emerald-500 to-teal-600",
    tint: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/20",
    permissions: ["PURCHASES_VIEW"],
  },
  {
    title: "Inventory",
    category: "Stock",
    description: "Stock control",
    href: "/inventory",
    icon: Package,
    accent: "from-amber-400 to-orange-600",
    tint: "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20",
    permissions: ["INVENTORY_VIEW"],
  },
  {
    title: "Contacts",
    category: "People",
    description: "Customers & suppliers",
    href: "/customers",
    icon: Users,
    accent: "from-sky-500 to-indigo-600",
    tint: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/20",
    permissions: ["CUSTOMERS_VIEW", "SUPPLIERS_VIEW"],
  },
  {
    title: "Accounting",
    category: "Finance",
    description: "Ledger & cash flow",
    href: "/accounting",
    icon: BookOpen,
    accent: "from-violet-500 to-purple-700",
    tint: "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/20",
    permissions: ["ACCOUNTING_VIEW"],
  },
  {
    title: "Expenses",
    category: "Finance",
    description: "Claims & approvals",
    href: "/expenses",
    icon: ReceiptText,
    accent: "from-lime-500 to-green-600",
    tint: "bg-lime-50 text-lime-800 ring-lime-100 dark:bg-lime-500/10 dark:text-lime-200 dark:ring-lime-500/20",
    permissions: ["EXPENSES_VIEW", "EXPENSES_CREATE"],
  },
  {
    title: "Employees",
    category: "Team",
    description: "People & access",
    href: "/employees",
    icon: Users,
    accent: "from-blue-500 to-slate-700",
    tint: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/20",
    permissions: ["EMPLOYEES_VIEW"],
  },
  {
    title: "Payroll",
    category: "Team",
    description: "Salary workflow",
    href: "/payroll",
    icon: Banknote,
    accent: "from-fuchsia-500 to-pink-600",
    tint: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100 dark:bg-fuchsia-500/10 dark:text-fuchsia-200 dark:ring-fuchsia-500/20",
    permissions: ["PAYROLL_VIEW"],
  },
  {
    title: "Reports",
    category: "Insight",
    description: "Business analysis",
    href: "/reports/sales",
    icon: BarChart3,
    accent: "from-indigo-500 to-blue-700",
    tint: "bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/20",
    permissions: ["REPORTS_VIEW"],
  },
  {
    title: "Stores",
    category: "Stock",
    description: "Locations & warehouses",
    href: "/inventory/warehouses",
    icon: Building2,
    accent: "from-teal-500 to-cyan-700",
    tint: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-500/10 dark:text-teal-200 dark:ring-teal-500/20",
    permissions: ["INVENTORY_VIEW"],
  },
  {
    title: "Templates",
    category: "Admin",
    description: "Document layouts",
    href: "/settings/templates",
    icon: FileText,
    accent: "from-pink-500 to-rose-600",
    tint: "bg-pink-50 text-pink-700 ring-pink-100 dark:bg-pink-500/10 dark:text-pink-200 dark:ring-pink-500/20",
    permissions: ["SETTINGS_MANAGE"],
  },
  {
    title: "Settings",
    category: "Admin",
    description: "Company control",
    href: "/settings",
    icon: Settings,
    accent: "from-zinc-700 to-slate-950",
    tint: "bg-zinc-100 text-zinc-800 ring-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-200 dark:ring-zinc-500/20",
    permissions: ["SETTINGS_VIEW"],
  },
];

type AppModule = (typeof apps)[number];

const workflowOrder = ["Sell", "Buy", "Stock", "Finance", "People", "Team", "Insight", "Admin"];

interface AppsPageProps {
  companySlug?: string | null;
  rolePermissions?: Record<string, string[]> | null;
  userPermissionOverrides?: Record<string, unknown> | null;
  planCode?: string | null;
}

function hasAnyPermission(required: string[], permissions: Set<string>) {
  return required.some((key) => {
    const value = (PERMISSIONS as Record<string, string>)[key];
    return value && permissions.has(value);
  });
}

export function AppsPage({
  companySlug,
  rolePermissions,
  userPermissionOverrides,
  planCode,
}: AppsPageProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const sessionUser = session?.user as
    | {
        companySlug?: string;
        role?: string;
      }
    | undefined;

  const role = sessionUser?.role || "STAFF";
  const tenantSlug = companySlug || sessionUser?.companySlug;

  const launcherPathname = tenantSlug && pathname === "/apps" ? `/${tenantSlug}${pathname}` : pathname;

  const permissions = new Set(
    applyPlanPermissionLimitsForRole(
      getEffectiveUserPermissions(role, rolePermissions, userPermissionOverrides),
      planCode,
      role,
    ),
  );

  const visibleApps = apps.filter((app) => hasAnyPermission(app.permissions, permissions));

  const [query, setQuery] = useState("");
  const [activeWorkflow, setActiveWorkflow] = useState("All");

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();

    return visibleApps.filter((app) => {
      const matchesWorkflow = activeWorkflow === "All" || app.category === activeWorkflow;
      const matchesQuery =
        !q ||
        app.title.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q);

      return matchesWorkflow && matchesQuery;
    });
  }, [visibleApps, query, activeWorkflow]);

  const workflows = [
    "All",
    ...workflowOrder.filter((workflow) => visibleApps.some((app) => app.category === workflow)),
  ];

  const priorityApps = filteredApps.slice(0, 4);

  return (
    <div className="w-full space-y-7">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-slate-950 text-white shadow-2xl shadow-slate-950/10 dark:border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(56,189,248,0.32),transparent_28rem),radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.22),transparent_26rem)]" />
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] lg:p-8">
          <div className="flex min-w-0 flex-col justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/75 backdrop-blur">
                <LayoutGrid className="h-3.5 w-3.5" />
                Apps
              </div>

              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Open the right workspace faster.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                Clean access to the modules allowed for your role. Search, filter, and launch without hunting through menus.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-medium text-white/70">
              <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10">
                {visibleApps.length} modules
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10">
                {workflows.length - 1} workflows
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10">
                {role}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Quick launch</p>
                <p className="text-xs text-white/60">Most common work areas</p>
              </div>
              <Zap className="h-5 w-5 text-cyan-200" />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {priorityApps.map((app) => {
                const Icon = app.icon;
                return (
                  <Link
                    key={app.title}
                    href={dashboardHref(launcherPathname, app.href)}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", app.accent)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{app.title}</span>
                      <span className="block truncate text-xs text-white/55">{app.description}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border/80 bg-card/95 p-3 shadow-sm backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search app..."
              className="h-11 w-full rounded-2xl border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0">
            {workflows.map((workflow) => (
              <button
                key={workflow}
                type="button"
                onClick={() => setActiveWorkflow(workflow)}
                className={cn(
                  "h-10 shrink-0 rounded-2xl border px-3.5 text-sm font-semibold transition",
                  activeWorkflow === workflow
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {workflow}
              </button>
            ))}
          </div>
        </div>
      </section>

      {visibleApps.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No modules enabled"
          description="Ask an administrator to review your role and permissions."
        />
      ) : filteredApps.length === 0 ? (
        <EmptyState icon={Search} title="No matches found" description="Try another workflow or search term." />
      ) : (
        <ModuleGrid modules={filteredApps} launcherPathname={launcherPathname} />
      )}
    </div>
  );
}

function ModuleGrid({
  modules,
  launcherPathname,
}: {
  modules: AppModule[];
  launcherPathname: string;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {modules.map((app) => {
        const Icon = app.icon;

        return (
          <Link
            key={app.title}
            href={dashboardHref(launcherPathname, app.href)}
            className="group relative min-h-[150px] overflow-hidden rounded-[1.5rem] border border-border/80 bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", app.accent)} />
            <div className="flex h-full flex-col justify-between gap-5">
              <div className="flex items-start justify-between gap-4">
                <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", app.accent)}>
                  <Icon className="h-6 w-6" />
                </span>

                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold ring-1", app.tint)}>
                  {app.category}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-semibold tracking-tight text-foreground">{app.title}</h3>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{app.description}</p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition group-hover:border-primary/30 group-hover:text-primary">
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-10 text-center">
      <Icon className="mx-auto h-9 w-9 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
