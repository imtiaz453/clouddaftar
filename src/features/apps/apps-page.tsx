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
    description: "Counter sales, barcode checkout, cash payments, and thermal receipts.",
    href: "/sales/new",
    icon: ShoppingCart,
    accent: "bg-rose-600",
    ring: "ring-rose-100",
    permissions: ["SALES_CREATE"],
  },
  {
    title: "Sales",
    category: "Sell",
    description: "Invoices, quotations, returns, customer payments, and statements.",
    href: "/sales",
    icon: FileText,
    accent: "bg-cyan-600",
    ring: "ring-cyan-100",
    permissions: ["SALES_VIEW"],
  },
  {
    title: "Purchases",
    category: "Buy",
    description: "Purchase orders, supplier bills, returns, and vendor payments.",
    href: "/purchases",
    icon: Truck,
    accent: "bg-emerald-600",
    ring: "ring-emerald-100",
    permissions: ["PURCHASES_VIEW"],
  },
  {
    title: "Inventory",
    category: "Stock",
    description: "Products, stock ledger, categories, barcodes, and low-stock control.",
    href: "/inventory",
    icon: Package,
    accent: "bg-amber-500",
    ring: "ring-amber-100",
    permissions: ["INVENTORY_VIEW"],
  },
  {
    title: "Contacts",
    category: "People",
    description: "Customers, suppliers, payment history, and business contacts.",
    href: "/customers",
    icon: Users,
    accent: "bg-sky-600",
    ring: "ring-sky-100",
    permissions: ["CUSTOMERS_VIEW", "SUPPLIERS_VIEW"],
  },
  {
    title: "Accounting",
    category: "Finance",
    description: "Receivables, payables, ledgers, reconciliation, and cash flow.",
    href: "/accounting",
    icon: BookOpen,
    accent: "bg-violet-600",
    ring: "ring-violet-100",
    permissions: ["ACCOUNTING_VIEW"],
  },
  {
    title: "Expenses",
    category: "Finance",
    description: "Employee expenses, receipts, reimbursements, and approvals.",
    href: "/expenses",
    icon: ReceiptText,
    accent: "bg-lime-600",
    ring: "ring-lime-100",
    permissions: ["EXPENSES_VIEW", "EXPENSES_CREATE"],
  },
  {
    title: "Employees",
    category: "Team",
    description: "Employee directory, roles, permissions, and HR operations.",
    href: "/employees",
    icon: Users,
    accent: "bg-blue-600",
    ring: "ring-blue-100",
    permissions: ["EMPLOYEES_VIEW"],
  },
  {
    title: "Payroll",
    category: "Team",
    description: "Payroll readiness, reimbursements, salary workflow, and handoff.",
    href: "/payroll",
    icon: Banknote,
    accent: "bg-fuchsia-600",
    ring: "ring-fuchsia-100",
    permissions: ["PAYROLL_VIEW"],
  },
  {
    title: "Reports",
    category: "Insight",
    description: "Sales, purchase, inventory, tax, aging, and exportable reports.",
    href: "/reports/sales",
    icon: BarChart3,
    accent: "bg-indigo-600",
    ring: "ring-indigo-100",
    permissions: ["REPORTS_VIEW"],
  },
  {
    title: "Branches & Warehouses",
    category: "Stock",
    description: "Branch locations, warehouses, stock zones, and operations.",
    href: "/inventory/warehouses",
    icon: Building2,
    accent: "bg-teal-600",
    ring: "ring-teal-100",
    permissions: ["INVENTORY_VIEW"],
  },
  {
    title: "Templates",
    category: "Admin",
    description: "Invoices, quotations, receipts, headers, footers, and labels.",
    href: "/settings/templates",
    icon: FileText,
    accent: "bg-pink-600",
    ring: "ring-pink-100",
    permissions: ["SETTINGS_MANAGE"],
  },
  {
    title: "Settings",
    category: "Admin",
    description: "Business profile, tax, localization, integrations, users, and theme.",
    href: "/settings",
    icon: Settings,
    accent: "bg-zinc-800",
    ring: "ring-zinc-100",
    permissions: ["SETTINGS_VIEW"],
  },
];

type AppModule = (typeof apps)[number];

const workflowOrder = [
  "Sell",
  "Buy",
  "Stock",
  "Finance",
  "People",
  "Team",
  "Insight",
  "Admin",
];

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

  const launcherPathname =
    tenantSlug && pathname === "/apps" ? `/${tenantSlug}${pathname}` : pathname;

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

  const groupedApps = filteredApps.reduce<Record<string, AppModule[]>>((groups, app) => {
    groups[app.category] = groups[app.category] ? [...groups[app.category], app] : [app];
    return groups;
  }, {});

  const workflows = [
    "All",
    ...workflowOrder.filter((workflow) => visibleApps.some((app) => app.category === workflow)),
  ];

  const orderedGroupedApps = workflowOrder
    .filter((workflow) => groupedApps[workflow]?.length)
    .map((workflow) => ({
      workflow,
      items: groupedApps[workflow],
    }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="relative p-5 sm:p-6 lg:p-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <LayoutGrid className="h-3.5 w-3.5" />
                Module Launcher
              </div>

              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Choose a module and get to work
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Access sales, inventory, finance, reports, settings, and daily business operations
                from one clean workspace.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:min-w-[360px]">
              <div className="rounded-lg bg-background p-3 shadow-sm">
                <p className="text-xl font-semibold tabular-nums">{visibleApps.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Available</p>
              </div>

              <div className="rounded-lg bg-background p-3 shadow-sm">
                <p className="text-xl font-semibold tabular-nums">
                  {Object.keys(groupedApps).length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Workflows</p>
              </div>

              <div className="rounded-lg bg-background p-3 shadow-sm">
                <p className="truncate text-xl font-semibold">{role}</p>
                <p className="mt-1 text-xs text-muted-foreground">Role</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search modules, workflows, or settings..."
                className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {workflows.map((workflow) => (
                <button
                  key={workflow}
                  type="button"
                  onClick={() => setActiveWorkflow(workflow)}
                  className={cn(
                    "h-10 rounded-xl border px-3 text-sm font-medium transition",
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
        </div>
      </section>

      {visibleApps.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No modules enabled"
          description="Ask an administrator to review your role and permissions."
        />
      ) : filteredApps.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches found"
          description="Try another workflow or search term."
        />
      ) : activeWorkflow === "All" ? (
        <div className="space-y-7">
          {orderedGroupedApps.map(({ workflow, items }) => (
            <section key={workflow} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{workflow}</h2>
                  <p className="text-xs text-muted-foreground">
                    {items.length} module{items.length === 1 ? "" : "s"} available
                  </p>
                </div>
              </div>

              <ModuleGrid modules={items} launcherPathname={launcherPathname} />
            </section>
          ))}
        </div>
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
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {modules.map((app) => {
        const Icon = app.icon;

        return (
          <Link
            key={app.title}
            href={dashboardHref(launcherPathname, app.href)}
            title={app.description}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ring-4",
                  app.accent,
                  app.ring,
                )}
              >
                <Icon className="h-6 w-6" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {app.category}
                    </p>

                    <h3 className="mt-1 truncate text-base font-semibold text-foreground">
                      {app.title}
                    </h3>
                  </div>

                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100" />
                </div>

                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {app.description}
                </p>
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
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
      <Icon className="mx-auto h-9 w-9 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}