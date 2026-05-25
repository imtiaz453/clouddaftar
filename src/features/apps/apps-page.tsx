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
    ring: "ring-rose-200",
    permissions: ["SALES_CREATE"],
  },
  {
    title: "Sales",
    category: "Sell",
    description: "Invoices, quotations, returns, customer payments, and statements.",
    href: "/sales",
    icon: FileText,
    accent: "bg-cyan-600",
    ring: "ring-cyan-200",
    permissions: ["SALES_VIEW"],
  },
  {
    title: "Purchases",
    category: "Buy",
    description: "Purchase orders, supplier bills, returns, and vendor payments.",
    href: "/purchases",
    icon: Truck,
    accent: "bg-emerald-600",
    ring: "ring-emerald-200",
    permissions: ["PURCHASES_VIEW"],
  },
  {
    title: "Inventory",
    category: "Stock",
    description: "Products, stock ledger, categories, barcodes, and low-stock control.",
    href: "/inventory",
    icon: Package,
    accent: "bg-amber-500",
    ring: "ring-amber-200",
    permissions: ["INVENTORY_VIEW"],
  },
  {
    title: "Contacts",
    category: "People",
    description: "Customers, suppliers, payment history, and business contacts.",
    href: "/customers",
    icon: Users,
    accent: "bg-sky-600",
    ring: "ring-sky-200",
    permissions: ["CUSTOMERS_VIEW", "SUPPLIERS_VIEW"],
  },
  {
    title: "Accounting",
    category: "Finance",
    description: "Receivables, payables, ledgers, reconciliation, and cash flow.",
    href: "/accounting",
    icon: BookOpen,
    accent: "bg-violet-600",
    ring: "ring-violet-200",
    permissions: ["ACCOUNTING_VIEW"],
  },
  {
    title: "Expenses",
    category: "Finance",
    description: "Employee expenses, receipts, reimbursements, and approvals.",
    href: "/expenses",
    icon: ReceiptText,
    accent: "bg-lime-600",
    ring: "ring-lime-200",
    permissions: ["EXPENSES_VIEW", "EXPENSES_CREATE"],
  },
  {
    title: "Employees",
    category: "Team",
    description: "Employee directory, roles, permissions, and HR operations.",
    href: "/employees",
    icon: Users,
    accent: "bg-blue-600",
    ring: "ring-blue-200",
    permissions: ["EMPLOYEES_VIEW"],
  },
  {
    title: "Payroll",
    category: "Team",
    description: "Payroll readiness, reimbursements, salary workflow, and handoff.",
    href: "/payroll",
    icon: Banknote,
    accent: "bg-fuchsia-600",
    ring: "ring-fuchsia-200",
    permissions: ["PAYROLL_VIEW"],
  },
  {
    title: "Reports",
    category: "Insight",
    description: "Sales, purchase, inventory, tax, aging, and exportable reports.",
    href: "/reports/sales",
    icon: BarChart3,
    accent: "bg-indigo-600",
    ring: "ring-indigo-200",
    permissions: ["REPORTS_VIEW"],
  },
  {
    title: "Branches & Warehouses",
    category: "Stock",
    description: "Branch locations, warehouses, stock zones, and operations.",
    href: "/inventory/warehouses",
    icon: Building2,
    accent: "bg-teal-600",
    ring: "ring-teal-200",
    permissions: ["INVENTORY_VIEW"],
  },
  {
    title: "Templates",
    category: "Admin",
    description: "Invoices, quotations, receipts, headers, footers, and labels.",
    href: "/settings/templates",
    icon: FileText,
    accent: "bg-pink-600",
    ring: "ring-pink-200",
    permissions: ["SETTINGS_MANAGE"],
  },
  {
    title: "Settings",
    category: "Admin",
    description: "Business profile, tax, localization, integrations, users, and theme.",
    href: "/settings",
    icon: Settings,
    accent: "bg-zinc-800",
    ring: "ring-zinc-200",
    permissions: ["SETTINGS_VIEW"],
  },
];

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
  const sessionUser = session?.user as { companySlug?: string; role?: string } | undefined;
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
  const groupedApps = filteredApps.reduce<Record<string, typeof apps>>((groups, app) => {
    groups[app.category] = groups[app.category] ? [...groups[app.category], app] : [app];
    return groups;
  }, {});
  const workflows = [
    "All",
    ...workflowOrder.filter((workflow) => visibleApps.some((app) => app.category === workflow)),
  ];

  return (
    <div className="page-stack mx-auto w-full max-w-7xl">
      <section className="px-1 py-2 sm:px-2 sm:py-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5" />
              Module launcher
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Choose a module and get to work
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Apps are grouped by workflow so your team can jump straight to sales, stock, finance,
              or admin — without digging through menus.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {[
              { value: visibleApps.length, label: "Available" },
              { value: Object.keys(groupedApps).length, label: "Workflows" },
              { value: role, label: "Role" },
            ].map((stat) => (
              <div key={stat.label} className="min-w-20">
                <p className="text-xl font-semibold tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search apps, workflows, or settings…"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {workflows.map((workflow) => (
              <button
                key={workflow}
                type="button"
                onClick={() => setActiveWorkflow(workflow)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-sm font-medium transition",
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
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <Sparkles className="mx-auto h-9 w-9 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No modules enabled</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask an administrator to review your role and permissions.
          </p>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <Search className="mx-auto h-9 w-9 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No matches</h2>
          <p className="mt-1 text-sm text-muted-foreground">Try another workflow or search term.</p>
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {filteredApps.map((app) => {
            const Icon = app.icon;
            return (
              <Link
                key={app.title}
                href={dashboardHref(launcherPathname, app.href)}
                title={app.description}
                className="group flex min-w-0 flex-col items-center rounded-lg px-2 py-3 text-center transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ring-4 transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-24 sm:w-24",
                    app.accent,
                    app.ring,
                  )}
                >
                  <Icon className="h-10 w-10 sm:h-12 sm:w-12" />
                </span>
                <h3 className="mt-3 text-sm font-semibold leading-tight">{app.title}</h3>
                <p className="mt-1 line-clamp-2 max-w-44 text-xs leading-5 text-muted-foreground">
                  {app.description}
                </p>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
