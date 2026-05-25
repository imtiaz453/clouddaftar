export const ROLES = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  STAFF: "STAFF",
  CASHIER: "CASHIER",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
  CASHIER: "Cashier",
};

export const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 100,
  ADMIN: 80,
  MANAGER: 60,
  STAFF: 40,
  CASHIER: 20,
};

export const CUSTOM_ROLE_PREFIX = "CUSTOM:";

export function isCustomRoleKey(role: string) {
  return role.startsWith(CUSTOM_ROLE_PREFIX);
}

export function makeCustomRoleKey(name: string) {
  return `${CUSTOM_ROLE_PREFIX}${name.trim()}`;
}

export function getCustomRoleLabel(role: string) {
  return isCustomRoleKey(role) ? role.slice(CUSTOM_ROLE_PREFIX.length) : role;
}

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_CREATE: "inventory.create",
  INVENTORY_EDIT: "inventory.edit",
  INVENTORY_DELETE: "inventory.delete",
  SALES_VIEW: "sales.view",
  SALES_VIEW_ALL: "sales.view_all",
  SALES_CREATE: "sales.create",
  SALES_EDIT: "sales.edit",
  SALES_DELETE: "sales.delete",
  PURCHASES_VIEW: "purchases.view",
  PURCHASES_VIEW_ALL: "purchases.view_all",
  PURCHASES_CREATE: "purchases.create",
  PURCHASES_EDIT: "purchases.edit",
  PURCHASES_DELETE: "purchases.delete",
  PURCHASES_APPROVE: "purchases.approve",
  PURCHASES_DRAFT: "purchases.draft",
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_EDIT: "customers.edit",
  CUSTOMERS_DELETE: "customers.delete",
  SUPPLIERS_VIEW: "suppliers.view",
  SUPPLIERS_CREATE: "suppliers.create",
  SUPPLIERS_EDIT: "suppliers.edit",
  SUPPLIERS_DELETE: "suppliers.delete",
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",
  USERS_VIEW: "users.view",
  USERS_INVITE: "users.invite",
  USERS_MANAGE: "users.manage",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_VIEW: "audit.view",
  BILLING_VIEW: "billing.view",
  ACCOUNTING_VIEW: "accounting.view",
  ACCOUNTING_MANAGE: "accounting.manage",
  ACCOUNTING_RECONCILE: "accounting.reconcile",
  ACCOUNTING_REPORTS: "accounting.reports",
  EXPENSES_VIEW: "expenses.view",
  EXPENSES_CREATE: "expenses.create",
  EXPENSES_APPROVE: "expenses.approve",
  EMPLOYEES_VIEW: "employees.view",
  EMPLOYEES_MANAGE: "employees.manage",
  PAYROLL_VIEW: "payroll.view",
  PAYROLL_MANAGE: "payroll.manage",
} as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_VIEW_ALL,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    PERMISSIONS.SALES_DELETE,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_VIEW_ALL,
    PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.PURCHASES_EDIT,
    PERMISSIONS.PURCHASES_DELETE,
    PERMISSIONS.PURCHASES_APPROVE,
    PERMISSIONS.PURCHASES_DRAFT,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_EDIT,
    PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SUPPLIERS_CREATE,
    PERMISSIONS.SUPPLIERS_EDIT,
    PERMISSIONS.SUPPLIERS_DELETE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_INVITE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.ACCOUNTING_MANAGE,
    PERMISSIONS.ACCOUNTING_RECONCILE,
    PERMISSIONS.ACCOUNTING_REPORTS,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.EXPENSES_APPROVE,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.PAYROLL_MANAGE,
  ],
  MANAGER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_VIEW_ALL,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_VIEW_ALL,
    PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.PURCHASES_EDIT,
    PERMISSIONS.PURCHASES_DRAFT,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_EDIT,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SUPPLIERS_CREATE,
    PERMISSIONS.SUPPLIERS_EDIT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.ACCOUNTING_MANAGE,
    PERMISSIONS.ACCOUNTING_REPORTS,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.EXPENSES_APPROVE,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.PAYROLL_MANAGE,
  ],
  STAFF: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SUPPLIERS_CREATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
  ],
  CASHIER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
  ],
};

export type RolePermissionMap = Record<string, string[]>;

export interface UserPermissionOverride {
  mode?: "role" | "custom";
  permissions?: string[];
}

export const PERMISSION_LABELS: Record<string, string> = {
  "dashboard.view": "View Dashboard",
  "inventory.view": "View Inventory",
  "inventory.create": "Create Products",
  "inventory.edit": "Edit Products",
  "inventory.delete": "Delete Products",
  "sales.view": "View Sales",
  "sales.view_all": "View All Sales",
  "sales.create": "Create Sales",
  "sales.edit": "Edit Sales",
  "sales.delete": "Delete Sales",
  "purchases.view": "View Purchases",
  "purchases.view_all": "View All Purchases",
  "purchases.create": "Create Purchases",
  "purchases.edit": "Edit Purchases",
  "purchases.delete": "Delete Purchases",
  "purchases.approve": "Approve Purchases",
  "purchases.draft": "Create Draft POs",
  "customers.view": "View Customers",
  "customers.create": "Create Customers",
  "customers.edit": "Edit Customers",
  "customers.delete": "Delete Customers",
  "suppliers.view": "View Suppliers",
  "suppliers.create": "Create Suppliers",
  "suppliers.edit": "Edit Suppliers",
  "suppliers.delete": "Delete Suppliers",
  "reports.view": "View Reports",
  "reports.export": "Export Reports",
  "users.view": "View Users",
  "users.invite": "Invite Users",
  "users.manage": "Manage Users & Permissions",
  "settings.view": "View Settings",
  "settings.manage": "Manage Settings",
  "audit.view": "View Audit Log",
  "billing.view": "View Billing",
  "accounting.view": "View Accounting",
  "accounting.manage": "Manage Accounting",
  "accounting.reconcile": "Reconcile Accounts",
  "accounting.reports": "Accounting Reports",
  "expenses.view": "View Expenses",
  "expenses.create": "Submit Expenses",
  "expenses.approve": "Approve Expenses",
  "employees.view": "View Employees",
  "employees.manage": "Manage Employees",
  "payroll.view": "View Payroll",
  "payroll.manage": "Manage Payroll",
};

export const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  {
    label: "Workspace",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.BILLING_VIEW,
    ],
  },
  {
    label: "Sales & Customers",
    permissions: [
      PERMISSIONS.SALES_VIEW,
      PERMISSIONS.SALES_VIEW_ALL,
      PERMISSIONS.SALES_CREATE,
      PERMISSIONS.SALES_EDIT,
      PERMISSIONS.SALES_DELETE,
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.CUSTOMERS_EDIT,
      PERMISSIONS.CUSTOMERS_DELETE,
    ],
  },
  {
    label: "Purchases & Suppliers",
    permissions: [
      PERMISSIONS.PURCHASES_VIEW,
      PERMISSIONS.PURCHASES_VIEW_ALL,
      PERMISSIONS.PURCHASES_CREATE,
      PERMISSIONS.PURCHASES_EDIT,
      PERMISSIONS.PURCHASES_DELETE,
      PERMISSIONS.PURCHASES_APPROVE,
      PERMISSIONS.PURCHASES_DRAFT,
      PERMISSIONS.SUPPLIERS_VIEW,
      PERMISSIONS.SUPPLIERS_CREATE,
      PERMISSIONS.SUPPLIERS_EDIT,
      PERMISSIONS.SUPPLIERS_DELETE,
    ],
  },
  {
    label: "Inventory",
    permissions: [
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_CREATE,
      PERMISSIONS.INVENTORY_EDIT,
      PERMISSIONS.INVENTORY_DELETE,
    ],
  },
  {
    label: "Accounting & Reports",
    permissions: [
      PERMISSIONS.ACCOUNTING_VIEW,
      PERMISSIONS.ACCOUNTING_MANAGE,
      PERMISSIONS.ACCOUNTING_RECONCILE,
      PERMISSIONS.ACCOUNTING_REPORTS,
      PERMISSIONS.EXPENSES_VIEW,
      PERMISSIONS.EXPENSES_CREATE,
      PERMISSIONS.EXPENSES_APPROVE,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
    ],
  },
  {
    label: "Team",
    permissions: [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_INVITE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.EMPLOYEES_VIEW,
      PERMISSIONS.EMPLOYEES_MANAGE,
      PERMISSIONS.PAYROLL_VIEW,
      PERMISSIONS.PAYROLL_MANAGE,
    ],
  },
];

const VALID_PERMISSION_VALUES = new Set(Object.values(PERMISSIONS));

export function sanitizePermissionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter((permission): permission is string => VALID_PERMISSION_VALUES.has(permission)),
    ),
  );
}

export function normalizeRolePermissionOverrides(value: unknown): RolePermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const output: RolePermissionMap = {};
  for (const role of Object.values(ROLES)) {
    const permissions = (value as Record<string, unknown>)[role];
    if (permissions !== undefined) {
      output[role] = sanitizePermissionList(permissions);
    }
  }
  for (const [role, permissions] of Object.entries(value as Record<string, unknown>)) {
    if (isCustomRoleKey(role) && getCustomRoleLabel(role).trim()) {
      output[role] = sanitizePermissionList(permissions);
    }
  }
  return output;
}

export function normalizeUserPermissionOverride(value: unknown): UserPermissionOverride {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { mode: "role", permissions: [] };
  }
  const raw = value as Record<string, unknown>;
  return {
    mode: raw.mode === "custom" ? "custom" : "role",
    permissions: sanitizePermissionList(raw.permissions),
  };
}

function withExpenseWorkflowPermissions(role: string, permissions: string[]) {
  const next = new Set(permissions);
  next.add(PERMISSIONS.EXPENSES_VIEW);
  next.add(PERMISSIONS.EXPENSES_CREATE);
  if (
    role === ROLES.OWNER ||
    role === ROLES.ADMIN ||
    role === ROLES.MANAGER ||
    next.has(PERMISSIONS.ACCOUNTING_MANAGE)
  ) {
    next.add(PERMISSIONS.EXPENSES_APPROVE);
  }
  return Array.from(next);
}

export function getEffectiveRolePermissions(role: string, overrides?: unknown): string[] {
  if (role === ROLES.OWNER) return Object.values(PERMISSIONS);
  const normalized = normalizeRolePermissionOverrides(overrides);
  return withExpenseWorkflowPermissions(role, normalized[role] ?? ROLE_PERMISSIONS[role] ?? []);
}

export function getEffectiveUserPermissions(
  role: string,
  roleOverrides?: unknown,
  userOverride?: unknown,
): string[] {
  const override = normalizeUserPermissionOverride(userOverride);
  if (role !== ROLES.OWNER && override.mode === "custom") {
    return withExpenseWorkflowPermissions(role, override.permissions ?? []);
  }
  return getEffectiveRolePermissions(role, roleOverrides);
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  permissions?: string[];
}

export interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    icon: "LayoutDashboard",
    items: [
      { label: "Dashboard", href: "/", icon: "LayoutDashboard", permissions: ["DASHBOARD_VIEW"] },
      { label: "Apps", href: "/apps", icon: "Layers", permissions: ["DASHBOARD_VIEW"] },
      { label: "Activity", href: "/audit-log", icon: "Activity", permissions: ["AUDIT_VIEW"] },
    ],
  },
  {
    label: "POS",
    icon: "ShoppingCart",
    items: [
      {
        label: "POS Register",
        href: "/sales/new",
        icon: "ShoppingCart",
        permissions: ["SALES_CREATE"],
      },
    ],
  },
  {
    label: "Sales",
    icon: "FileText",
    items: [
      { label: "Sales Invoices", href: "/sales", icon: "FileText", permissions: ["SALES_VIEW"] },
      {
        label: "Customer Payments",
        href: "/customer-payments",
        icon: "Wallet",
        permissions: ["SALES_VIEW"],
      },
      { label: "Returns", href: "/sales/returns", icon: "RotateCcw", permissions: ["SALES_VIEW"] },
      {
        label: "Quotations",
        href: "/quotations",
        icon: "ClipboardList",
        permissions: ["SALES_VIEW"],
      },
      {
        label: "Customer Statements",
        href: "/reports/customer-statement",
        icon: "FileText",
        permissions: ["ACCOUNTING_VIEW"],
      },
    ],
  },
  {
    label: "Purchases",
    icon: "Truck",
    items: [
      {
        label: "Purchases",
        href: "/purchases",
        icon: "ShoppingBag",
        permissions: ["PURCHASES_VIEW"],
      },
      {
        label: "Supplier Payments",
        href: "/supplier-payments",
        icon: "CreditCard",
        permissions: ["PURCHASES_VIEW"],
      },
      {
        label: "Purchase Returns",
        href: "/purchases/returns",
        icon: "RotateCcw",
        permissions: ["PURCHASES_VIEW"],
      },
      {
        label: "Supplier Statements",
        href: "/reports/supplier-statement",
        icon: "FileText",
        permissions: ["ACCOUNTING_VIEW"],
      },
    ],
  },
  {
    label: "Inventory",
    icon: "Package",
    items: [
      { label: "Products", href: "/inventory", icon: "Package", permissions: ["INVENTORY_VIEW"] },
      {
        label: "Categories",
        href: "/inventory/categories",
        icon: "Layers",
        permissions: ["INVENTORY_VIEW"],
      },
      {
        label: "Units",
        href: "/inventory/units",
        icon: "Ruler",
        permissions: ["INVENTORY_VIEW"],
      },
      {
        label: "Branches & Warehouses",
        href: "/inventory/warehouses",
        icon: "Building2",
        permissions: ["INVENTORY_VIEW"],
      },
      {
        label: "Barcode Management",
        href: "/inventory/barcodes",
        icon: "ScanLine",
        permissions: ["INVENTORY_VIEW"],
      },
      {
        label: "Stock Adjustment",
        href: "/inventory/adjustments",
        icon: "ArrowUpDown",
        permissions: ["INVENTORY_EDIT"],
      },
      {
        label: "Inventory Ledger",
        href: "/inventory/ledger",
        icon: "BookOpen",
        permissions: ["INVENTORY_VIEW"],
      },
      {
        label: "Low Stock Alerts",
        href: "/inventory/low-stock",
        icon: "AlertTriangle",
        permissions: ["INVENTORY_VIEW"],
      },
    ],
  },
  {
    label: "Contacts",
    icon: "Users",
    items: [
      { label: "Customers", href: "/customers", icon: "Users", permissions: ["CUSTOMERS_VIEW"] },
      {
        label: "Suppliers",
        href: "/suppliers",
        icon: "Building2",
        permissions: ["SUPPLIERS_VIEW"],
      },
    ],
  },
  {
    label: "Accounting",
    icon: "BarChart3",
    items: [
      {
        label: "Dashboard",
        href: "/accounting",
        icon: "BarChart3",
        permissions: ["ACCOUNTING_VIEW"],
      },
      {
        label: "Expenses",
        href: "/accounting/expenses",
        icon: "Wallet",
        permissions: ["EXPENSES_APPROVE"],
      },
      {
        label: "Customer Invoices",
        href: "/accounts-receivable",
        icon: "BookOpen",
        permissions: ["ACCOUNTING_VIEW"],
      },
      {
        label: "Vendor Bills",
        href: "/accounts-payable",
        icon: "BookOpen",
        permissions: ["ACCOUNTING_VIEW"],
      },
      {
        label: "Income / Expense",
        href: "/income-expense",
        icon: "TrendingUp",
        permissions: ["ACCOUNTING_VIEW"],
      },
      {
        label: "Cash Flow",
        href: "/cash-flow",
        icon: "DollarSign",
        permissions: ["ACCOUNTING_VIEW"],
      },
      {
        label: "Chart of Accounts",
        href: "/accounting/chart-of-accounts",
        icon: "FolderTree",
        permissions: ["ACCOUNTING_VIEW"],
      },
      {
        label: "Journal Entries",
        href: "/accounting/journal-entries",
        icon: "BookOpen",
        permissions: ["ACCOUNTING_VIEW"],
      },
      {
        label: "Financial Reports",
        href: "/accounting/financial-reports",
        icon: "FileSpreadsheet",
        permissions: ["ACCOUNTING_REPORTS"],
      },
      {
        label: "Reports",
        href: "/accounting-reports",
        icon: "FileSpreadsheet",
        permissions: ["ACCOUNTING_REPORTS"],
      },
    ],
  },
  {
    label: "Reports",
    icon: "BarChart3",
    items: [
      {
        label: "Sales Reports",
        href: "/reports/sales",
        icon: "BarChart3",
        permissions: ["REPORTS_VIEW"],
      },
      {
        label: "Purchase Reports",
        href: "/reports/purchases",
        icon: "BarChart3",
        permissions: ["REPORTS_VIEW"],
      },
      {
        label: "Inventory Reports",
        href: "/reports/inventory",
        icon: "Package",
        permissions: ["REPORTS_VIEW"],
      },
      {
        label: "Tax / VAT Reports",
        href: "/reports/tax",
        icon: "FileText",
        permissions: ["REPORTS_VIEW"],
      },
      {
        label: "Receivable Aging",
        href: "/accounts-receivable/aging",
        icon: "PieChart",
        permissions: ["ACCOUNTING_REPORTS"],
      },
      {
        label: "Payable Aging",
        href: "/accounts-payable/aging",
        icon: "PieChart",
        permissions: ["ACCOUNTING_REPORTS"],
      },
    ],
  },
  {
    label: "Expenses",
    icon: "Wallet",
    items: [
      {
        label: "My Expenses",
        href: "/expenses",
        icon: "Wallet",
        permissions: ["EXPENSES_VIEW"],
      },
    ],
  },
  {
    label: "Employees",
    icon: "Users",
    items: [
      {
        label: "Employees",
        href: "/employees",
        icon: "Users",
        permissions: ["EMPLOYEES_VIEW"],
      },
      {
        label: "Payroll",
        href: "/payroll",
        icon: "Banknote",
        permissions: ["PAYROLL_VIEW"],
      },
    ],
  },
  {
    label: "Administration",
    icon: "Shield",
    items: [
      { label: "Users", href: "/users", icon: "UserCog", permissions: ["USERS_VIEW"] },
      {
        label: "Roles & Permissions",
        href: "/users/roles",
        icon: "Shield",
        permissions: ["USERS_MANAGE"],
      },
      {
        label: "Workspace Settings",
        href: "/settings",
        icon: "Settings",
        permissions: ["SETTINGS_VIEW"],
      },
      {
        label: "Invoice Templates",
        href: "/settings/templates",
        icon: "FileText",
        permissions: ["SETTINGS_MANAGE"],
      },
      {
        label: "Theme & Branding",
        href: "/settings?tab=theme",
        icon: "Palette",
        permissions: ["SETTINGS_MANAGE"],
      },
    ],
  },
];

export const SIDEBAR_BOTTOM_ITEMS: NavItem[] = [
  {
    label: "Billing & Subscription",
    href: "/billing",
    icon: "CreditCard",
    permissions: ["BILLING_VIEW"],
  },
  { label: "Help / Support", href: "/help", icon: "HelpCircle" },
  { label: "Logout", href: "#logout", icon: "LogOut" },
];
