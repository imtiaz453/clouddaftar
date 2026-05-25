"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  BookOpen,
  ClipboardCheck,
  FileText,
  Landmark,
  PieChart,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { dashboardHref } from "@/lib/dashboard-href";
import { formatCurrency } from "@/lib/utils";

interface AccountingDashboardData {
  customerInvoices: {
    toValidate: number;
    unpaid: number;
    unpaidAmount: number;
    late: number;
    lateAmount: number;
  };
  vendorBills: {
    toValidate: number;
    toPay: number;
    toPayAmount: number;
    late: number;
    lateAmount: number;
  };
  bank: {
    balance: number;
    paymentsIn: number;
    paymentsOut: number;
    toReconcile: number;
  };
  cash: {
    balance: number;
    received: number;
    paid: number;
  };
  expenses: {
    underValidation: number;
    toReimburse: number;
  };
  chartOfAccounts: {
    code: string;
    name: string;
    type: string;
    balance: number;
    reconcile: boolean;
  }[];
  tax: {
    outputTax: number;
    inputTax: number;
    netTax: number;
  };
  controls: {
    customers: number;
    vendors: number;
    reconciliations: number;
    ledgerEntries: number;
    inventoryValue: number;
  };
  trend: { date: string; received: number; paid: number }[];
}

interface Props {
  data: AccountingDashboardData;
}

const moduleTabs = [
  { label: "Dashboard", href: "/accounting" },
  { label: "Customers", href: "/accounts-receivable" },
  { label: "Vendors", href: "/accounts-payable" },
  { label: "Journal Entries", href: "/accounting/journal-entries" },
  { label: "Chart of Accounts", href: "/accounting/chart-of-accounts" },
  { label: "Financial Reports", href: "/accounting/financial-reports" },
];

function MetricLine({ label, count, amount }: { label: string; count?: number; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-teal-700 dark:text-teal-300">
        {count !== undefined ? `${count} ${label}` : label}
      </span>
      <span className="shrink-0 font-medium tabular-nums">{formatCurrency(amount)}</span>
    </div>
  );
}

function WorkPanel({
  title,
  icon: Icon,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  children,
  accent = "border-l-violet-500",
}: {
  title: string;
  icon: typeof FileText;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  children: React.ReactNode;
  accent?: string;
}) {
  const pathname = usePathname();

  return (
    <section className={`border-l-4 ${accent} bg-background p-4 shadow-sm ring-1 ring-border`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" />
          <h2 className="text-base font-semibold text-teal-800 dark:text-teal-200">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="h-8 bg-[#714b67] hover:bg-[#5f3f57]">
            <Link href={dashboardHref(pathname, primaryHref)}>{primaryLabel}</Link>
          </Button>
          {secondaryLabel && secondaryHref && (
            <Button asChild size="sm" variant="secondary" className="h-8">
              <Link href={dashboardHref(pathname, secondaryHref)}>{secondaryLabel}</Link>
            </Button>
          )}
        </div>
      </div>
      <div className="mt-5 space-y-2">{children}</div>
    </section>
  );
}

function WorkspaceGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function WorkspaceLink({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  href: string;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={dashboardHref(pathname, href)}
      className="flex min-w-0 gap-3 border bg-background p-4 shadow-sm transition hover:bg-accent/40"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#714b67]/10 text-[#714b67]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}

export function AccountingDashboardClient({ data }: Props) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between">
        <PageHeader
          title="Accounting"
          description="Invoices, vendor bills, cash, reports, and approvals"
        />
        <nav className="flex gap-1 overflow-x-auto pb-1">
          {moduleTabs.map((tab) => (
            <Link
              key={tab.href}
              href={dashboardHref(pathname, tab.href)}
              className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkPanel
          title="Customer Invoices"
          icon={FileText}
          primaryLabel="New"
          primaryHref="/sales/new"
          secondaryLabel="Invoices"
          secondaryHref="/sales"
        >
          <MetricLine label="To Validate" count={data.customerInvoices.toValidate} amount={0} />
          <MetricLine
            label="Unpaid"
            count={data.customerInvoices.unpaid}
            amount={data.customerInvoices.unpaidAmount}
          />
          <MetricLine
            label="Late"
            count={data.customerInvoices.late}
            amount={data.customerInvoices.lateAmount}
          />
          <MiniBars
            values={[
              data.customerInvoices.lateAmount,
              data.customerInvoices.unpaidAmount,
              data.customerInvoices.toValidate,
            ]}
          />
        </WorkPanel>

        <WorkPanel
          title="Vendor Bills"
          icon={ReceiptText}
          primaryLabel="Upload"
          primaryHref="/purchases"
          secondaryLabel="New"
          secondaryHref="/purchases"
          accent="border-l-sky-500"
        >
          <MetricLine label="To Validate" count={data.vendorBills.toValidate} amount={0} />
          <MetricLine
            label="To Pay"
            count={data.vendorBills.toPay}
            amount={data.vendorBills.toPayAmount}
          />
          <MetricLine
            label="Late"
            count={data.vendorBills.late}
            amount={data.vendorBills.lateAmount}
          />
          <MiniBars
            values={[
              data.vendorBills.lateAmount,
              data.vendorBills.toPayAmount,
              data.vendorBills.toValidate,
            ]}
          />
        </WorkPanel>

        <WorkPanel
          title="Bank"
          icon={Landmark}
          primaryLabel="Transactions"
          primaryHref="/cash-flow"
          secondaryLabel={`${data.bank.toReconcile} to reconcile`}
          secondaryHref="/cash-flow"
          accent="border-l-emerald-500"
        >
          <MetricLine label="Balance" amount={data.bank.balance} />
          <MetricLine label="Payments" amount={data.bank.paymentsIn} />
          <MetricLine label="Misc. Operations" amount={data.bank.paymentsOut} />
          <div className="h-44 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke="#714b67"
                  fill="#714b67"
                  fillOpacity={0.16}
                />
                <Area
                  type="monotone"
                  dataKey="paid"
                  stroke="#0f766e"
                  fill="#0f766e"
                  fillOpacity={0.12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </WorkPanel>

        <WorkPanel
          title="Cash"
          icon={Banknote}
          primaryLabel="Transactions"
          primaryHref="/cash-flow"
          secondaryLabel="Payments"
          secondaryHref="/customer-payments"
          accent="border-l-amber-500"
        >
          <MetricLine label="Balance" amount={data.cash.balance} />
          <MetricLine label="Received" amount={data.cash.received} />
          <MetricLine label="Paid" amount={data.cash.paid} />
          <div className="grid gap-3 pt-3 sm:grid-cols-2">
            <QuickLink icon={ArrowDownCircle} label="Receive Payment" href="/customer-payments" />
            <QuickLink icon={ArrowUpCircle} label="Pay Vendor" href="/supplier-payments" />
            <QuickLink icon={Users} label="Customer Ledger" href="/accounts-receivable" />
            <QuickLink icon={BookOpen} label="Supplier Ledger" href="/accounts-payable" />
          </div>
        </WorkPanel>
      </div>

      <div className="grid gap-4 border-t pt-5 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="border bg-background p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Chart of Accounts</h2>
              <p className="text-sm text-muted-foreground">
                Control accounts derived from receivables, payables, inventory, bank/cash, and
                tax movement.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={dashboardHref(pathname, "/accounting-reports")}>Open reports</Link>
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Code</th>
                  <th className="py-2 text-left font-medium">Account</th>
                  <th className="py-2 text-left font-medium">Type</th>
                  <th className="py-2 text-left font-medium">Reconcile</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.chartOfAccounts.map((account) => (
                  <tr key={account.code} className="border-b last:border-0">
                    <td className="py-3 font-mono text-xs">{account.code}</td>
                    <td className="py-3 font-medium">{account.name}</td>
                    <td className="py-3">{account.type}</td>
                    <td className="py-3">
                      <Badge variant={account.reconcile ? "success" : "secondary"}>
                        {account.reconcile ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right font-medium">
                      {formatCurrency(account.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="border bg-background p-4 shadow-sm">
            <h2 className="text-base font-semibold">Tax Closing</h2>
            <div className="mt-4 space-y-3">
              <MetricLine label="Output Tax" amount={data.tax.outputTax} />
              <MetricLine label="Input Tax" amount={data.tax.inputTax} />
              <MetricLine label="Net Tax" amount={data.tax.netTax} />
            </div>
          </div>
          <div className="border bg-background p-4 shadow-sm">
            <h2 className="text-base font-semibold">Accounting Controls</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <ControlMetric label="Customers" value={data.controls.customers} />
              <ControlMetric label="Vendors" value={data.controls.vendors} />
              <ControlMetric label="Ledger Entries" value={data.controls.ledgerEntries} />
              <ControlMetric label="Reconciliations" value={data.controls.reconciliations} />
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6 border-t pt-5">
        <WorkspaceGroup
          title="Customers Workspace"
          description="Draft, confirm, send, collect, follow up, and audit customer receivables."
        >
          <WorkspaceLink
            icon={FileText}
            title="Invoices"
            description="Create invoices, manage lines, payment terms, and invoice status."
            href="/sales"
          />
          <WorkspaceLink
            icon={Banknote}
            title="Payments"
            description="Register and match customer payments to open invoices."
            href="/accounts-receivable"
          />
          <WorkspaceLink
            icon={PieChart}
            title="Credit Notes & Follow-ups"
            description="Use returns, aging, reminders, and customer statements for overdue accounts."
            href="/accounts-receivable/aging"
          />
        </WorkspaceGroup>

        <WorkspaceGroup
          title="Vendors Workspace"
          description="Record vendor bills, settle suppliers, and validate employee expenses."
        >
          <WorkspaceLink
            icon={ReceiptText}
            title="Vendor Bills"
            description="Review bills, purchases, purchase orders, and payable balances."
            href="/accounts-payable"
          />
          <WorkspaceLink
            icon={ArrowUpCircle}
            title="Vendor Payments"
            description="Process supplier payments and inspect supplier payment history."
            href="/supplier-payments"
          />
          <WorkspaceLink
            icon={Users}
            title="Employee Expenses"
            description={`Validate ${formatCurrency(data.expenses.underValidation)} and reimburse ${formatCurrency(data.expenses.toReimburse)}.`}
            href="/accounting/expenses"
          />
        </WorkspaceGroup>

        <WorkspaceGroup
          title="Accounting Workspace"
          description="Use ledgers, cash operations, and reconciliation to keep books traceable."
        >
          <WorkspaceLink
            icon={BookOpen}
            title="Journals & Ledger Entries"
            description="Open customer and supplier ledger trails from accounting documents."
            href="/accounting-reports"
          />
          <WorkspaceLink
            icon={ClipboardCheck}
            title="Reconciliation"
            description="Manually match payments and ledger entries, then resolve differences."
            href="/reconciliation"
          />
          <WorkspaceLink
            icon={Landmark}
            title="Bank & Cash"
            description="Track cash flow, inflows, outflows, and liquidity movement."
            href="/cash-flow"
          />
        </WorkspaceGroup>

        <WorkspaceGroup
          title="Reporting Workspace"
          description="Financial, analytical, audit, tax/VAT, partner ledger, and aging views."
        >
          <WorkspaceLink
            icon={FileText}
            title="Financial Statements"
            description="Profit/loss, income and expense movement, and cash flow reporting."
            href="/income-expense"
          />
          <WorkspaceLink
            icon={PieChart}
            title="Aged Receivable / Payable"
            description="Click into customer and supplier aging risk by bucket."
            href="/accounting-reports"
          />
          <WorkspaceLink
            icon={ReceiptText}
            title="Tax / VAT Audit"
            description="Review tax/VAT reports and regional compliance totals."
            href="/reports/tax"
          />
        </WorkspaceGroup>

        <WorkspaceGroup
          title="Configuration Workspace"
          description="Localization, fiscal settings, currencies, permissions, and accounting controls."
        >
          <WorkspaceLink
            icon={SlidersHorizontal}
            title="Settings & Taxes"
            description="Configure VAT/tax, ZATCA/FBR, fiscal localization, and currencies."
            href="/settings?tab=tax"
          />
          <WorkspaceLink
            icon={Settings}
            title="Accounting Controls"
            description="Review permissions, approval control, and company finance settings."
            href="/users/roles"
          />
          <WorkspaceLink
            icon={BookOpen}
            title="Chart of Accounts"
            description="Manage account types, codes, and hierarchy."
            href="/accounting/chart-of-accounts"
          />
        </WorkspaceGroup>
      </div>
    </div>
  );
}

function ControlMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof FileText;
  label: string;
  href: string;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={dashboardHref(pathname, href)}
      className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-accent"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mt-6 flex h-24 items-end gap-5 border-b border-muted px-1">
      {values.map((value, index) => (
        <div key={index} className="flex flex-1 items-end justify-center border-l border-muted">
          <span
            className="block w-16 max-w-full bg-teal-200 dark:bg-teal-700/60"
            style={{ height: `${Math.max(18, (value / max) * 82)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
