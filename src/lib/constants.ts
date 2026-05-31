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
  APPS_VIEW: "apps.view",

  // Sales / POS
  POS_USE: "pos.use",
  SALES_VIEW: "sales.view",
  SALES_VIEW_ALL: "sales.view_all",
  SALES_CREATE: "sales.create",
  SALES_EDIT: "sales.edit",
  SALES_DELETE: "sales.delete",
  SALES_COMPLETE: "sales.complete",
  SALES_DRAFT: "sales.draft",
  SALES_REFUND: "sales.refund",
  SALES_PRINT: "sales.print",
  SALES_RETURNS_VIEW: "sales.returns.view",
  SALES_RETURNS_MANAGE: "sales.returns.manage",
  CUSTOMER_PAYMENTS_VIEW: "customer_payments.view",
  CUSTOMER_PAYMENTS_CREATE: "customer_payments.create",
  CUSTOMER_PAYMENTS_DELETE: "customer_payments.delete",
  QUOTATIONS_VIEW: "quotations.view",
  QUOTATIONS_CREATE: "quotations.create",
  QUOTATIONS_EDIT: "quotations.edit",
  QUOTATIONS_DELETE: "quotations.delete",
  QUOTATIONS_CONVERT: "quotations.convert",

  // Customers / suppliers
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_EDIT: "customers.edit",
  CUSTOMERS_DELETE: "customers.delete",
  CUSTOMER_STATEMENTS_VIEW: "customer_statements.view",
  CUSTOMER_STATEMENTS_EXPORT: "customer_statements.export",
  SUPPLIERS_VIEW: "suppliers.view",
  SUPPLIERS_CREATE: "suppliers.create",
  SUPPLIERS_EDIT: "suppliers.edit",
  SUPPLIERS_DELETE: "suppliers.delete",
  SUPPLIER_STATEMENTS_VIEW: "supplier_statements.view",
  SUPPLIER_STATEMENTS_EXPORT: "supplier_statements.export",

  // Purchasing
  PURCHASES_VIEW: "purchases.view",
  PURCHASES_VIEW_ALL: "purchases.view_all",
  PURCHASES_CREATE: "purchases.create",
  PURCHASES_EDIT: "purchases.edit",
  PURCHASES_DELETE: "purchases.delete",
  PURCHASES_APPROVE: "purchases.approve",
  PURCHASES_DRAFT: "purchases.draft",
  PURCHASES_RECEIVE: "purchases.receive",
  PURCHASES_CLOSE: "purchases.close",
  PURCHASE_RETURNS_VIEW: "purchase_returns.view",
  PURCHASE_RETURNS_MANAGE: "purchase_returns.manage",
  SUPPLIER_PAYMENTS_VIEW: "supplier_payments.view",
  SUPPLIER_PAYMENTS_CREATE: "supplier_payments.create",
  SUPPLIER_PAYMENTS_DELETE: "supplier_payments.delete",

  // Inventory
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_CREATE: "inventory.create",
  INVENTORY_EDIT: "inventory.edit",
  INVENTORY_DELETE: "inventory.delete",
  INVENTORY_PRODUCTS_VIEW: "inventory.products.view",
  INVENTORY_PRODUCTS_MANAGE: "inventory.products.manage",
  INVENTORY_CATEGORIES_VIEW: "inventory.categories.view",
  INVENTORY_CATEGORIES_MANAGE: "inventory.categories.manage",
  INVENTORY_UNITS_VIEW: "inventory.units.view",
  INVENTORY_UNITS_MANAGE: "inventory.units.manage",
  INVENTORY_LOCATIONS_VIEW: "inventory.locations.view",
  INVENTORY_LOCATIONS_MANAGE: "inventory.locations.manage",
  INVENTORY_MAIN_RECEIVING_MANAGE: "inventory.main_receiving.manage",
  INVENTORY_TRANSFERS_VIEW: "inventory.transfers.view",
  INVENTORY_TRANSFERS_CREATE: "inventory.transfers.create",
  INVENTORY_TRANSFERS_APPROVE: "inventory.transfers.approve",
  INVENTORY_ADJUSTMENTS_VIEW: "inventory.adjustments.view",
  INVENTORY_ADJUSTMENTS_CREATE: "inventory.adjustments.create",
  INVENTORY_STOCK_COUNTS_VIEW: "inventory.stock_counts.view",
  INVENTORY_STOCK_COUNTS_MANAGE: "inventory.stock_counts.manage",
  INVENTORY_LEDGER_VIEW: "inventory.ledger.view",
  INVENTORY_LOW_STOCK_VIEW: "inventory.low_stock.view",
  INVENTORY_BARCODES_VIEW: "inventory.barcodes.view",
  INVENTORY_BARCODES_MANAGE: "inventory.barcodes.manage",
  INVENTORY_COST_VIEW: "inventory.cost.view",

  // Accounting / finance
  ACCOUNTING_VIEW: "accounting.view",
  ACCOUNTING_MANAGE: "accounting.manage",
  ACCOUNTING_RECONCILE: "accounting.reconcile",
  ACCOUNTING_REPORTS: "accounting.reports",
  CHART_OF_ACCOUNTS_VIEW: "chart_of_accounts.view",
  CHART_OF_ACCOUNTS_MANAGE: "chart_of_accounts.manage",
  JOURNAL_ENTRIES_VIEW: "journal_entries.view",
  JOURNAL_ENTRIES_CREATE: "journal_entries.create",
  JOURNAL_ENTRIES_POST: "journal_entries.post",
  AR_VIEW: "accounts_receivable.view",
  AP_VIEW: "accounts_payable.view",
  CASH_FLOW_VIEW: "cash_flow.view",
  INCOME_EXPENSE_VIEW: "income_expense.view",
  EXPENSES_VIEW: "expenses.view",
  EXPENSES_CREATE: "expenses.create",
  EXPENSES_APPROVE: "expenses.approve",
  EXPENSES_DELETE: "expenses.delete",

  // Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",
  SALES_REPORTS_VIEW: "reports.sales.view",
  PURCHASE_REPORTS_VIEW: "reports.purchases.view",
  INVENTORY_REPORTS_VIEW: "reports.inventory.view",
  TAX_REPORTS_VIEW: "reports.tax.view",
  AGING_REPORTS_VIEW: "reports.aging.view",

  // Team / HR
  USERS_VIEW: "users.view",
  USERS_INVITE: "users.invite",
  USERS_MANAGE: "users.manage",
  USERS_RESET_PASSWORD: "users.reset_password",
  USERS_DISABLE: "users.disable",
  ROLES_MANAGE: "roles.manage",
  EMPLOYEES_VIEW: "employees.view",
  EMPLOYEES_MANAGE: "employees.manage",
  PAYROLL_VIEW: "payroll.view",
  PAYROLL_MANAGE: "payroll.manage",

  // Settings / workspace
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",
  COMPANY_SETTINGS_MANAGE: "settings.company.manage",
  BRANCHES_VIEW: "settings.branches.view",
  BRANCHES_MANAGE: "settings.branches.manage",
  STORES_VIEW: "settings.stores.view",
  STORES_MANAGE: "settings.stores.manage",
  TEMPLATES_VIEW: "settings.templates.view",
  TEMPLATES_MANAGE: "settings.templates.manage",
  TAX_SETTINGS_MANAGE: "settings.tax.manage",
  BRANDING_MANAGE: "settings.branding.manage",
  INTEGRATIONS_MANAGE: "settings.integrations.manage",
  AUDIT_VIEW: "audit.view",
  BILLING_VIEW: "billing.view",
  BILLING_MANAGE: "billing.manage",
} as const;

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: Object.values(PERMISSIONS),
  MANAGER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.APPS_VIEW,
    PERMISSIONS.POS_USE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_VIEW_ALL,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    PERMISSIONS.SALES_COMPLETE,
    PERMISSIONS.SALES_DRAFT,
    PERMISSIONS.SALES_REFUND,
    PERMISSIONS.SALES_PRINT,
    PERMISSIONS.SALES_RETURNS_VIEW,
    PERMISSIONS.SALES_RETURNS_MANAGE,
    PERMISSIONS.CUSTOMER_PAYMENTS_VIEW,
    PERMISSIONS.CUSTOMER_PAYMENTS_CREATE,
    PERMISSIONS.QUOTATIONS_VIEW,
    PERMISSIONS.QUOTATIONS_CREATE,
    PERMISSIONS.QUOTATIONS_EDIT,
    PERMISSIONS.QUOTATIONS_CONVERT,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_EDIT,
    PERMISSIONS.CUSTOMER_STATEMENTS_VIEW,
    PERMISSIONS.CUSTOMER_STATEMENTS_EXPORT,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_VIEW_ALL,
    PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.PURCHASES_EDIT,
    PERMISSIONS.PURCHASES_APPROVE,
    PERMISSIONS.PURCHASES_DRAFT,
    PERMISSIONS.PURCHASES_RECEIVE,
    PERMISSIONS.PURCHASES_CLOSE,
    PERMISSIONS.PURCHASE_RETURNS_VIEW,
    PERMISSIONS.PURCHASE_RETURNS_MANAGE,
    PERMISSIONS.SUPPLIER_PAYMENTS_VIEW,
    PERMISSIONS.SUPPLIER_PAYMENTS_CREATE,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SUPPLIERS_CREATE,
    PERMISSIONS.SUPPLIERS_EDIT,
    PERMISSIONS.SUPPLIER_STATEMENTS_VIEW,
    PERMISSIONS.SUPPLIER_STATEMENTS_EXPORT,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_PRODUCTS_MANAGE,
    PERMISSIONS.INVENTORY_CATEGORIES_VIEW,
    PERMISSIONS.INVENTORY_CATEGORIES_MANAGE,
    PERMISSIONS.INVENTORY_UNITS_VIEW,
    PERMISSIONS.INVENTORY_UNITS_MANAGE,
    PERMISSIONS.INVENTORY_LOCATIONS_VIEW,
    PERMISSIONS.INVENTORY_LOCATIONS_MANAGE,
    PERMISSIONS.INVENTORY_MAIN_RECEIVING_MANAGE,
    PERMISSIONS.INVENTORY_TRANSFERS_VIEW,
    PERMISSIONS.INVENTORY_TRANSFERS_CREATE,
    PERMISSIONS.INVENTORY_TRANSFERS_APPROVE,
    PERMISSIONS.INVENTORY_ADJUSTMENTS_VIEW,
    PERMISSIONS.INVENTORY_ADJUSTMENTS_CREATE,
    PERMISSIONS.INVENTORY_STOCK_COUNTS_VIEW,
    PERMISSIONS.INVENTORY_STOCK_COUNTS_MANAGE,
    PERMISSIONS.INVENTORY_LEDGER_VIEW,
    PERMISSIONS.INVENTORY_LOW_STOCK_VIEW,
    PERMISSIONS.INVENTORY_BARCODES_VIEW,
    PERMISSIONS.INVENTORY_BARCODES_MANAGE,
    PERMISSIONS.INVENTORY_COST_VIEW,
    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.ACCOUNTING_MANAGE,
    PERMISSIONS.ACCOUNTING_REPORTS,
    PERMISSIONS.CHART_OF_ACCOUNTS_VIEW,
    PERMISSIONS.CHART_OF_ACCOUNTS_MANAGE,
    PERMISSIONS.JOURNAL_ENTRIES_VIEW,
    PERMISSIONS.JOURNAL_ENTRIES_CREATE,
    PERMISSIONS.AR_VIEW,
    PERMISSIONS.AP_VIEW,
    PERMISSIONS.CASH_FLOW_VIEW,
    PERMISSIONS.INCOME_EXPENSE_VIEW,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.EXPENSES_APPROVE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.SALES_REPORTS_VIEW,
    PERMISSIONS.PURCHASE_REPORTS_VIEW,
    PERMISSIONS.INVENTORY_REPORTS_VIEW,
    PERMISSIONS.TAX_REPORTS_VIEW,
    PERMISSIONS.AGING_REPORTS_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.PAYROLL_MANAGE,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.BRANCHES_VIEW,
    PERMISSIONS.STORES_VIEW,
    PERMISSIONS.TEMPLATES_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],
  STAFF: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.APPS_VIEW,
    PERMISSIONS.POS_USE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_COMPLETE,
    PERMISSIONS.SALES_PRINT,
    PERMISSIONS.CUSTOMER_PAYMENTS_VIEW,
    PERMISSIONS.CUSTOMER_PAYMENTS_CREATE,
    PERMISSIONS.QUOTATIONS_VIEW,
    PERMISSIONS.QUOTATIONS_CREATE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.PURCHASES_DRAFT,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.SUPPLIERS_CREATE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_LOCATIONS_VIEW,
    PERMISSIONS.INVENTORY_TRANSFERS_VIEW,
    PERMISSIONS.INVENTORY_LEDGER_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SALES_REPORTS_VIEW,
    PERMISSIONS.INVENTORY_REPORTS_VIEW,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
  ],
  CASHIER: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.APPS_VIEW,
    PERMISSIONS.POS_USE,
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_COMPLETE,
    PERMISSIONS.SALES_PRINT,
    PERMISSIONS.CUSTOMER_PAYMENTS_VIEW,
    PERMISSIONS.CUSTOMER_PAYMENTS_CREATE,
    PERMISSIONS.CUSTOMERS_VIEW,
  ],
};

export type RolePermissionMap = Record<string, string[]>;

export interface UserPermissionOverride {
  mode?: "role" | "custom";
  permissions?: string[];
}

export const PERMISSION_LABELS: Record<string, string> = {
  "dashboard.view": "View Dashboard",
  "apps.view": "Open Apps Launcher",
  "pos.use": "Use POS Register",

  "sales.view": "View Sales Invoices",
  "sales.view_all": "View All Sales",
  "sales.create": "Create Sales Invoices",
  "sales.edit": "Edit Sales Invoices",
  "sales.delete": "Delete Sales Invoices",
  "sales.complete": "Complete / Post Invoices",
  "sales.draft": "Move Invoice Back to Draft",
  "sales.refund": "Refund Invoices",
  "sales.print": "Print / Download Invoices",
  "sales.returns.view": "View Sales Returns",
  "sales.returns.manage": "Manage Sales Returns",
  "customer_payments.view": "View Customer Payments",
  "customer_payments.create": "Record Customer Payments",
  "customer_payments.delete": "Delete Customer Payments",
  "quotations.view": "View Quotations",
  "quotations.create": "Create Quotations",
  "quotations.edit": "Edit Quotations",
  "quotations.delete": "Delete Quotations",
  "quotations.convert": "Convert Quotation to Invoice",

  "customers.view": "View Customers",
  "customers.create": "Create Customers",
  "customers.edit": "Edit Customers",
  "customers.delete": "Delete Customers",
  "customer_statements.view": "View Customer Statements",
  "customer_statements.export": "Export Customer Statements",
  "suppliers.view": "View Suppliers",
  "suppliers.create": "Create Suppliers",
  "suppliers.edit": "Edit Suppliers",
  "suppliers.delete": "Delete Suppliers",
  "supplier_statements.view": "View Supplier Statements",
  "supplier_statements.export": "Export Supplier Statements",

  "purchases.view": "View Purchase Orders",
  "purchases.view_all": "View All Purchases",
  "purchases.create": "Create Purchase Orders",
  "purchases.edit": "Edit Purchase Orders",
  "purchases.delete": "Delete Purchase Orders",
  "purchases.approve": "Approve Purchases",
  "purchases.draft": "Move PO Back to Draft",
  "purchases.receive": "Receive Purchase Stock",
  "purchases.close": "Close Purchase Orders",
  "purchase_returns.view": "View Purchase Returns",
  "purchase_returns.manage": "Manage Purchase Returns",
  "supplier_payments.view": "View Supplier Payments",
  "supplier_payments.create": "Record Supplier Payments",
  "supplier_payments.delete": "Delete Supplier Payments",

  "inventory.view": "View Inventory Dashboard",
  "inventory.create": "Create Inventory Items",
  "inventory.edit": "Edit Inventory Items",
  "inventory.delete": "Delete Inventory Items",
  "inventory.products.view": "View Products",
  "inventory.products.manage": "Manage Products",
  "inventory.categories.view": "View Categories",
  "inventory.categories.manage": "Manage Categories",
  "inventory.units.view": "View Units",
  "inventory.units.manage": "Manage Units",
  "inventory.locations.view": "View Stores / Warehouses",
  "inventory.locations.manage": "Manage Stores / Warehouses",
  "inventory.main_receiving.manage": "Set Main PO Receiving Warehouse",
  "inventory.transfers.view": "View Stock Transfers",
  "inventory.transfers.create": "Create Stock Transfers",
  "inventory.transfers.approve": "Approve / Complete Transfers",
  "inventory.adjustments.view": "View Stock Adjustments",
  "inventory.adjustments.create": "Create Stock Adjustments",
  "inventory.stock_counts.view": "View Stock Counts",
  "inventory.stock_counts.manage": "Manage Stock Counts",
  "inventory.ledger.view": "View Stock Ledger",
  "inventory.low_stock.view": "View Low Stock Alerts",
  "inventory.barcodes.view": "View Barcodes",
  "inventory.barcodes.manage": "Manage Barcodes",
  "inventory.cost.view": "View Inventory Cost / Value",

  "accounting.view": "View Accounting",
  "accounting.manage": "Manage Accounting",
  "accounting.reconcile": "Reconcile Accounts",
  "accounting.reports": "View Accounting Reports",
  "chart_of_accounts.view": "View Chart of Accounts",
  "chart_of_accounts.manage": "Manage Chart of Accounts",
  "journal_entries.view": "View Journal Entries",
  "journal_entries.create": "Create Journal Entries",
  "journal_entries.post": "Post Journal Entries",
  "accounts_receivable.view": "View Accounts Receivable",
  "accounts_payable.view": "View Accounts Payable",
  "cash_flow.view": "View Cash Flow",
  "income_expense.view": "View Income / Expense",
  "expenses.view": "View Expenses",
  "expenses.create": "Submit Expenses",
  "expenses.approve": "Approve Expenses",
  "expenses.delete": "Delete Expenses",

  "reports.view": "View Reports Center",
  "reports.export": "Export Reports",
  "reports.sales.view": "View Sales Reports",
  "reports.purchases.view": "View Purchase Reports",
  "reports.inventory.view": "View Inventory Reports",
  "reports.tax.view": "View Tax / VAT Reports",
  "reports.aging.view": "View Aging Reports",

  "users.view": "View Users",
  "users.invite": "Invite Users",
  "users.manage": "Manage Users & Permissions",
  "users.reset_password": "Reset User Passwords",
  "users.disable": "Disable / Enable Users",
  "roles.manage": "Manage Role Presets",
  "employees.view": "View Employees",
  "employees.manage": "Manage Employees",
  "payroll.view": "View Payroll",
  "payroll.manage": "Manage Payroll",

  "settings.view": "View Settings",
  "settings.manage": "Manage Settings",
  "settings.company.manage": "Manage Company Profile",
  "settings.branches.view": "View Branches",
  "settings.branches.manage": "Manage Branches",
  "settings.stores.view": "View Stores Settings",
  "settings.stores.manage": "Manage Stores Settings",
  "settings.templates.view": "View Document Templates",
  "settings.templates.manage": "Manage Document Templates",
  "settings.tax.manage": "Manage Tax Settings",
  "settings.branding.manage": "Manage Theme & Branding",
  "settings.integrations.manage": "Manage Integrations",
  "audit.view": "View Audit Log",
  "billing.view": "View Billing",
  "billing.manage": "Manage Billing",
};

export const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  {
    label: "Workspace & Control",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.APPS_VIEW,
      PERMISSIONS.SETTINGS_VIEW,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.BILLING_VIEW,
      PERMISSIONS.BILLING_MANAGE,
    ],
  },
  {
    label: "Sales, POS & Quotations",
    permissions: [
      PERMISSIONS.POS_USE,
      PERMISSIONS.SALES_VIEW,
      PERMISSIONS.SALES_VIEW_ALL,
      PERMISSIONS.SALES_CREATE,
      PERMISSIONS.SALES_EDIT,
      PERMISSIONS.SALES_DELETE,
      PERMISSIONS.SALES_COMPLETE,
      PERMISSIONS.SALES_DRAFT,
      PERMISSIONS.SALES_REFUND,
      PERMISSIONS.SALES_PRINT,
      PERMISSIONS.SALES_RETURNS_VIEW,
      PERMISSIONS.SALES_RETURNS_MANAGE,
      PERMISSIONS.QUOTATIONS_VIEW,
      PERMISSIONS.QUOTATIONS_CREATE,
      PERMISSIONS.QUOTATIONS_EDIT,
      PERMISSIONS.QUOTATIONS_DELETE,
      PERMISSIONS.QUOTATIONS_CONVERT,
    ],
  },
  {
    label: "Customers & Receipts",
    permissions: [
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.CUSTOMERS_EDIT,
      PERMISSIONS.CUSTOMERS_DELETE,
      PERMISSIONS.CUSTOMER_PAYMENTS_VIEW,
      PERMISSIONS.CUSTOMER_PAYMENTS_CREATE,
      PERMISSIONS.CUSTOMER_PAYMENTS_DELETE,
      PERMISSIONS.CUSTOMER_STATEMENTS_VIEW,
      PERMISSIONS.CUSTOMER_STATEMENTS_EXPORT,
    ],
  },
  {
    label: "Purchases, Receiving & Suppliers",
    permissions: [
      PERMISSIONS.PURCHASES_VIEW,
      PERMISSIONS.PURCHASES_VIEW_ALL,
      PERMISSIONS.PURCHASES_CREATE,
      PERMISSIONS.PURCHASES_EDIT,
      PERMISSIONS.PURCHASES_DELETE,
      PERMISSIONS.PURCHASES_APPROVE,
      PERMISSIONS.PURCHASES_DRAFT,
      PERMISSIONS.PURCHASES_RECEIVE,
      PERMISSIONS.PURCHASES_CLOSE,
      PERMISSIONS.PURCHASE_RETURNS_VIEW,
      PERMISSIONS.PURCHASE_RETURNS_MANAGE,
      PERMISSIONS.SUPPLIERS_VIEW,
      PERMISSIONS.SUPPLIERS_CREATE,
      PERMISSIONS.SUPPLIERS_EDIT,
      PERMISSIONS.SUPPLIERS_DELETE,
      PERMISSIONS.SUPPLIER_PAYMENTS_VIEW,
      PERMISSIONS.SUPPLIER_PAYMENTS_CREATE,
      PERMISSIONS.SUPPLIER_PAYMENTS_DELETE,
      PERMISSIONS.SUPPLIER_STATEMENTS_VIEW,
      PERMISSIONS.SUPPLIER_STATEMENTS_EXPORT,
    ],
  },
  {
    label: "Inventory, Stores & Stock Control",
    permissions: [
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_CREATE,
      PERMISSIONS.INVENTORY_EDIT,
      PERMISSIONS.INVENTORY_DELETE,
      PERMISSIONS.INVENTORY_PRODUCTS_VIEW,
      PERMISSIONS.INVENTORY_PRODUCTS_MANAGE,
      PERMISSIONS.INVENTORY_CATEGORIES_VIEW,
      PERMISSIONS.INVENTORY_CATEGORIES_MANAGE,
      PERMISSIONS.INVENTORY_UNITS_VIEW,
      PERMISSIONS.INVENTORY_UNITS_MANAGE,
      PERMISSIONS.INVENTORY_LOCATIONS_VIEW,
      PERMISSIONS.INVENTORY_LOCATIONS_MANAGE,
      PERMISSIONS.INVENTORY_MAIN_RECEIVING_MANAGE,
      PERMISSIONS.INVENTORY_TRANSFERS_VIEW,
      PERMISSIONS.INVENTORY_TRANSFERS_CREATE,
      PERMISSIONS.INVENTORY_TRANSFERS_APPROVE,
      PERMISSIONS.INVENTORY_ADJUSTMENTS_VIEW,
      PERMISSIONS.INVENTORY_ADJUSTMENTS_CREATE,
      PERMISSIONS.INVENTORY_STOCK_COUNTS_VIEW,
      PERMISSIONS.INVENTORY_STOCK_COUNTS_MANAGE,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.INVENTORY_LOW_STOCK_VIEW,
      PERMISSIONS.INVENTORY_BARCODES_VIEW,
      PERMISSIONS.INVENTORY_BARCODES_MANAGE,
      PERMISSIONS.INVENTORY_COST_VIEW,
    ],
  },
  {
    label: "Accounting, Expenses & Finance",
    permissions: [
      PERMISSIONS.ACCOUNTING_VIEW,
      PERMISSIONS.ACCOUNTING_MANAGE,
      PERMISSIONS.ACCOUNTING_RECONCILE,
      PERMISSIONS.ACCOUNTING_REPORTS,
      PERMISSIONS.CHART_OF_ACCOUNTS_VIEW,
      PERMISSIONS.CHART_OF_ACCOUNTS_MANAGE,
      PERMISSIONS.JOURNAL_ENTRIES_VIEW,
      PERMISSIONS.JOURNAL_ENTRIES_CREATE,
      PERMISSIONS.JOURNAL_ENTRIES_POST,
      PERMISSIONS.AR_VIEW,
      PERMISSIONS.AP_VIEW,
      PERMISSIONS.CASH_FLOW_VIEW,
      PERMISSIONS.INCOME_EXPENSE_VIEW,
      PERMISSIONS.EXPENSES_VIEW,
      PERMISSIONS.EXPENSES_CREATE,
      PERMISSIONS.EXPENSES_APPROVE,
      PERMISSIONS.EXPENSES_DELETE,
    ],
  },
  {
    label: "Reports & Analytics",
    permissions: [
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.SALES_REPORTS_VIEW,
      PERMISSIONS.PURCHASE_REPORTS_VIEW,
      PERMISSIONS.INVENTORY_REPORTS_VIEW,
      PERMISSIONS.TAX_REPORTS_VIEW,
      PERMISSIONS.AGING_REPORTS_VIEW,
    ],
  },
  {
    label: "Team, HR & Payroll",
    permissions: [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.USERS_INVITE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.USERS_RESET_PASSWORD,
      PERMISSIONS.USERS_DISABLE,
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.EMPLOYEES_VIEW,
      PERMISSIONS.EMPLOYEES_MANAGE,
      PERMISSIONS.PAYROLL_VIEW,
      PERMISSIONS.PAYROLL_MANAGE,
    ],
  },
  {
    label: "Company Settings",
    permissions: [
      PERMISSIONS.COMPANY_SETTINGS_MANAGE,
      PERMISSIONS.BRANCHES_VIEW,
      PERMISSIONS.BRANCHES_MANAGE,
      PERMISSIONS.STORES_VIEW,
      PERMISSIONS.STORES_MANAGE,
      PERMISSIONS.TEMPLATES_VIEW,
      PERMISSIONS.TEMPLATES_MANAGE,
      PERMISSIONS.TAX_SETTINGS_MANAGE,
      PERMISSIONS.BRANDING_MANAGE,
      PERMISSIONS.INTEGRATIONS_MANAGE,
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

function permissionHasAny(next: Set<string>, values: string[]) {
  return values.some((value) => next.has(value));
}

function withPermissionDependencies(permissions: string[]) {
  const next = new Set(permissions);

  if (next.has(PERMISSIONS.APPS_VIEW)) next.add(PERMISSIONS.DASHBOARD_VIEW);

  if (
    permissionHasAny(next, [
      PERMISSIONS.POS_USE,
      PERMISSIONS.SALES_CREATE,
      PERMISSIONS.SALES_EDIT,
      PERMISSIONS.SALES_COMPLETE,
      PERMISSIONS.SALES_DRAFT,
      PERMISSIONS.SALES_REFUND,
      PERMISSIONS.SALES_PRINT,
      PERMISSIONS.SALES_RETURNS_VIEW,
      PERMISSIONS.SALES_RETURNS_MANAGE,
      PERMISSIONS.QUOTATIONS_VIEW,
      PERMISSIONS.QUOTATIONS_CREATE,
      PERMISSIONS.QUOTATIONS_EDIT,
      PERMISSIONS.QUOTATIONS_DELETE,
      PERMISSIONS.QUOTATIONS_CONVERT,
      PERMISSIONS.CUSTOMER_PAYMENTS_VIEW,
      PERMISSIONS.CUSTOMER_PAYMENTS_CREATE,
      PERMISSIONS.CUSTOMER_PAYMENTS_DELETE,
    ])
  ) {
    next.add(PERMISSIONS.SALES_VIEW);
  }
  if (permissionHasAny(next, [PERMISSIONS.POS_USE, PERMISSIONS.SALES_COMPLETE])) {
    next.add(PERMISSIONS.SALES_CREATE);
  }
  if (permissionHasAny(next, [PERMISSIONS.QUOTATIONS_CREATE, PERMISSIONS.QUOTATIONS_EDIT, PERMISSIONS.QUOTATIONS_CONVERT])) {
    next.add(PERMISSIONS.QUOTATIONS_VIEW);
  }
  if (permissionHasAny(next, [PERMISSIONS.CUSTOMER_PAYMENTS_CREATE, PERMISSIONS.CUSTOMER_PAYMENTS_DELETE])) {
    next.add(PERMISSIONS.CUSTOMER_PAYMENTS_VIEW);
    next.add(PERMISSIONS.CUSTOMERS_VIEW);
  }
  if (permissionHasAny(next, [PERMISSIONS.CUSTOMER_STATEMENTS_VIEW, PERMISSIONS.CUSTOMER_STATEMENTS_EXPORT])) {
    next.add(PERMISSIONS.CUSTOMERS_VIEW);
    next.add(PERMISSIONS.ACCOUNTING_VIEW);
  }

  if (
    permissionHasAny(next, [
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.CUSTOMERS_EDIT,
      PERMISSIONS.CUSTOMERS_DELETE,
    ])
  ) {
    next.add(PERMISSIONS.CUSTOMERS_VIEW);
  }
  if (
    permissionHasAny(next, [
      PERMISSIONS.SUPPLIERS_CREATE,
      PERMISSIONS.SUPPLIERS_EDIT,
      PERMISSIONS.SUPPLIERS_DELETE,
    ])
  ) {
    next.add(PERMISSIONS.SUPPLIERS_VIEW);
  }

  if (
    permissionHasAny(next, [
      PERMISSIONS.PURCHASES_CREATE,
      PERMISSIONS.PURCHASES_EDIT,
      PERMISSIONS.PURCHASES_DELETE,
      PERMISSIONS.PURCHASES_APPROVE,
      PERMISSIONS.PURCHASES_DRAFT,
      PERMISSIONS.PURCHASES_RECEIVE,
      PERMISSIONS.PURCHASES_CLOSE,
      PERMISSIONS.PURCHASE_RETURNS_VIEW,
      PERMISSIONS.PURCHASE_RETURNS_MANAGE,
      PERMISSIONS.SUPPLIER_PAYMENTS_VIEW,
      PERMISSIONS.SUPPLIER_PAYMENTS_CREATE,
      PERMISSIONS.SUPPLIER_PAYMENTS_DELETE,
    ])
  ) {
    next.add(PERMISSIONS.PURCHASES_VIEW);
  }
  if (permissionHasAny(next, [PERMISSIONS.PURCHASES_RECEIVE, PERMISSIONS.PURCHASES_CLOSE])) {
    next.add(PERMISSIONS.INVENTORY_VIEW);
  }
  if (permissionHasAny(next, [PERMISSIONS.SUPPLIER_PAYMENTS_CREATE, PERMISSIONS.SUPPLIER_PAYMENTS_DELETE])) {
    next.add(PERMISSIONS.SUPPLIER_PAYMENTS_VIEW);
    next.add(PERMISSIONS.SUPPLIERS_VIEW);
  }
  if (permissionHasAny(next, [PERMISSIONS.SUPPLIER_STATEMENTS_VIEW, PERMISSIONS.SUPPLIER_STATEMENTS_EXPORT])) {
    next.add(PERMISSIONS.SUPPLIERS_VIEW);
    next.add(PERMISSIONS.ACCOUNTING_VIEW);
  }

  if (
    permissionHasAny(next, [
      PERMISSIONS.INVENTORY_PRODUCTS_VIEW,
      PERMISSIONS.INVENTORY_PRODUCTS_MANAGE,
      PERMISSIONS.INVENTORY_CATEGORIES_VIEW,
      PERMISSIONS.INVENTORY_CATEGORIES_MANAGE,
      PERMISSIONS.INVENTORY_UNITS_VIEW,
      PERMISSIONS.INVENTORY_UNITS_MANAGE,
      PERMISSIONS.INVENTORY_LOCATIONS_VIEW,
      PERMISSIONS.INVENTORY_LOCATIONS_MANAGE,
      PERMISSIONS.INVENTORY_MAIN_RECEIVING_MANAGE,
      PERMISSIONS.INVENTORY_TRANSFERS_VIEW,
      PERMISSIONS.INVENTORY_TRANSFERS_CREATE,
      PERMISSIONS.INVENTORY_TRANSFERS_APPROVE,
      PERMISSIONS.INVENTORY_ADJUSTMENTS_VIEW,
      PERMISSIONS.INVENTORY_ADJUSTMENTS_CREATE,
      PERMISSIONS.INVENTORY_STOCK_COUNTS_VIEW,
      PERMISSIONS.INVENTORY_STOCK_COUNTS_MANAGE,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.INVENTORY_LOW_STOCK_VIEW,
      PERMISSIONS.INVENTORY_BARCODES_VIEW,
      PERMISSIONS.INVENTORY_BARCODES_MANAGE,
      PERMISSIONS.INVENTORY_COST_VIEW,
    ])
  ) {
    next.add(PERMISSIONS.INVENTORY_VIEW);
  }
  if (
    permissionHasAny(next, [
      PERMISSIONS.INVENTORY_PRODUCTS_MANAGE,
      PERMISSIONS.INVENTORY_CATEGORIES_MANAGE,
      PERMISSIONS.INVENTORY_UNITS_MANAGE,
      PERMISSIONS.INVENTORY_LOCATIONS_MANAGE,
      PERMISSIONS.INVENTORY_MAIN_RECEIVING_MANAGE,
      PERMISSIONS.INVENTORY_TRANSFERS_CREATE,
      PERMISSIONS.INVENTORY_TRANSFERS_APPROVE,
      PERMISSIONS.INVENTORY_ADJUSTMENTS_CREATE,
      PERMISSIONS.INVENTORY_STOCK_COUNTS_MANAGE,
      PERMISSIONS.INVENTORY_BARCODES_MANAGE,
    ])
  ) {
    next.add(PERMISSIONS.INVENTORY_EDIT);
  }

  if (
    permissionHasAny(next, [
      PERMISSIONS.CHART_OF_ACCOUNTS_VIEW,
      PERMISSIONS.CHART_OF_ACCOUNTS_MANAGE,
      PERMISSIONS.JOURNAL_ENTRIES_VIEW,
      PERMISSIONS.JOURNAL_ENTRIES_CREATE,
      PERMISSIONS.JOURNAL_ENTRIES_POST,
      PERMISSIONS.AR_VIEW,
      PERMISSIONS.AP_VIEW,
      PERMISSIONS.CASH_FLOW_VIEW,
      PERMISSIONS.INCOME_EXPENSE_VIEW,
      PERMISSIONS.ACCOUNTING_REPORTS,
    ])
  ) {
    next.add(PERMISSIONS.ACCOUNTING_VIEW);
  }
  if (
    permissionHasAny(next, [
      PERMISSIONS.CHART_OF_ACCOUNTS_MANAGE,
      PERMISSIONS.JOURNAL_ENTRIES_CREATE,
      PERMISSIONS.JOURNAL_ENTRIES_POST,
    ])
  ) {
    next.add(PERMISSIONS.ACCOUNTING_MANAGE);
  }

  if (
    permissionHasAny(next, [
      PERMISSIONS.SALES_REPORTS_VIEW,
      PERMISSIONS.PURCHASE_REPORTS_VIEW,
      PERMISSIONS.INVENTORY_REPORTS_VIEW,
      PERMISSIONS.TAX_REPORTS_VIEW,
      PERMISSIONS.AGING_REPORTS_VIEW,
    ])
  ) {
    next.add(PERMISSIONS.REPORTS_VIEW);
  }
  if (
    permissionHasAny(next, [
      PERMISSIONS.CUSTOMER_STATEMENTS_EXPORT,
      PERMISSIONS.SUPPLIER_STATEMENTS_EXPORT,
    ])
  ) {
    next.add(PERMISSIONS.REPORTS_EXPORT);
  }

  if (permissionHasAny(next, [PERMISSIONS.USERS_INVITE, PERMISSIONS.USERS_MANAGE, PERMISSIONS.USERS_RESET_PASSWORD, PERMISSIONS.USERS_DISABLE])) {
    next.add(PERMISSIONS.USERS_VIEW);
  }
  if (next.has(PERMISSIONS.ROLES_MANAGE)) next.add(PERMISSIONS.USERS_MANAGE);
  if (permissionHasAny(next, [PERMISSIONS.EMPLOYEES_MANAGE])) next.add(PERMISSIONS.EMPLOYEES_VIEW);
  if (permissionHasAny(next, [PERMISSIONS.PAYROLL_MANAGE])) next.add(PERMISSIONS.PAYROLL_VIEW);

  if (
    permissionHasAny(next, [
      PERMISSIONS.COMPANY_SETTINGS_MANAGE,
      PERMISSIONS.BRANCHES_VIEW,
      PERMISSIONS.BRANCHES_MANAGE,
      PERMISSIONS.STORES_VIEW,
      PERMISSIONS.STORES_MANAGE,
      PERMISSIONS.TEMPLATES_VIEW,
      PERMISSIONS.TEMPLATES_MANAGE,
      PERMISSIONS.TAX_SETTINGS_MANAGE,
      PERMISSIONS.BRANDING_MANAGE,
      PERMISSIONS.INTEGRATIONS_MANAGE,
    ])
  ) {
    next.add(PERMISSIONS.SETTINGS_VIEW);
  }
  if (
    permissionHasAny(next, [
      PERMISSIONS.COMPANY_SETTINGS_MANAGE,
      PERMISSIONS.BRANCHES_MANAGE,
      PERMISSIONS.STORES_MANAGE,
      PERMISSIONS.TEMPLATES_MANAGE,
      PERMISSIONS.TAX_SETTINGS_MANAGE,
      PERMISSIONS.BRANDING_MANAGE,
      PERMISSIONS.INTEGRATIONS_MANAGE,
    ])
  ) {
    next.add(PERMISSIONS.SETTINGS_MANAGE);
  }
  if (next.has(PERMISSIONS.BILLING_MANAGE)) next.add(PERMISSIONS.BILLING_VIEW);

  return Array.from(next);
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
  return withPermissionDependencies(
    withExpenseWorkflowPermissions(role, normalized[role] ?? ROLE_PERMISSIONS[role] ?? []),
  );
}

export function getEffectiveUserPermissions(
  role: string,
  roleOverrides?: unknown,
  userOverride?: unknown,
): string[] {
  const override = normalizeUserPermissionOverride(userOverride);
  if (role !== ROLES.OWNER && override.mode === "custom") {
    return withPermissionDependencies(withExpenseWorkflowPermissions(role, override.permissions ?? []));
  }
  return getEffectiveRolePermissions(role, roleOverrides);
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  permissions?: string[];
  badge?: string | number;
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
      { label: "Apps", href: "/apps", icon: "Layers", permissions: ["APPS_VIEW"] },
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
        permissions: ["POS_USE", "SALES_CREATE"],
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
        permissions: ["CUSTOMER_PAYMENTS_VIEW"],
      },
      { label: "Returns", href: "/sales/returns", icon: "RotateCcw", permissions: ["SALES_RETURNS_VIEW"] },
      {
        label: "Quotations",
        href: "/quotations",
        icon: "ClipboardList",
        permissions: ["QUOTATIONS_VIEW"],
      },
      {
        label: "Customer Statements",
        href: "/reports/customer-statement",
        icon: "FileText",
        permissions: ["CUSTOMER_STATEMENTS_VIEW"],
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
        permissions: ["SUPPLIER_PAYMENTS_VIEW"],
      },
      {
        label: "Purchase Returns",
        href: "/purchases/returns",
        icon: "RotateCcw",
        permissions: ["PURCHASE_RETURNS_VIEW"],
      },
      {
        label: "Supplier Statements",
        href: "/reports/supplier-statement",
        icon: "FileText",
        permissions: ["SUPPLIER_STATEMENTS_VIEW"],
      },
    ],
  },
  {
    label: "Inventory",
    icon: "Package",
    items: [
      { label: "Inventory Dashboard", href: "/inventory", icon: "LayoutDashboard", permissions: ["INVENTORY_VIEW"] },
      {
        label: "Products",
        href: "/inventory/products",
        icon: "Package",
        permissions: ["INVENTORY_PRODUCTS_VIEW"],
      },
      {
        label: "Categories",
        href: "/inventory/categories",
        icon: "Layers",
        permissions: ["INVENTORY_CATEGORIES_VIEW"],
      },
      {
        label: "Units",
        href: "/inventory/units",
        icon: "Ruler",
        permissions: ["INVENTORY_UNITS_VIEW"],
      },
      {
        label: "Inventory Locations",
        href: "/inventory/locations",
        icon: "Building2",
        permissions: ["INVENTORY_LOCATIONS_VIEW"],
      },
      {
        label: "Stock Transfers",
        href: "/inventory/transfers",
        icon: "ArrowRightLeft",
        permissions: ["INVENTORY_TRANSFERS_VIEW"],
      },
      {
        label: "Stock Adjustments",
        href: "/inventory/adjustments",
        icon: "ArrowUpDown",
        permissions: ["INVENTORY_ADJUSTMENTS_VIEW"],
      },
      {
        label: "Stock Counts",
        href: "/inventory/stock-counts",
        icon: "ClipboardCheck",
        permissions: ["INVENTORY_STOCK_COUNTS_VIEW"],
      },
      {
        label: "Stock Ledger",
        href: "/inventory/ledger",
        icon: "BookOpen",
        permissions: ["INVENTORY_LEDGER_VIEW"],
      },
      {
        label: "Low Stock Alerts",
        href: "/inventory/low-stock",
        icon: "AlertTriangle",
        permissions: ["INVENTORY_LOW_STOCK_VIEW"],
      },
      {
        label: "Barcode Management",
        href: "/inventory/barcodes",
        icon: "ScanLine",
        permissions: ["INVENTORY_BARCODES_VIEW"],
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
        permissions: ["EXPENSES_VIEW"],
      },
      {
        label: "Customer Invoices",
        href: "/accounts-receivable",
        icon: "BookOpen",
        permissions: ["AR_VIEW"],
      },
      {
        label: "Vendor Bills",
        href: "/accounts-payable",
        icon: "BookOpen",
        permissions: ["AP_VIEW"],
      },
      {
        label: "Income / Expense",
        href: "/income-expense",
        icon: "TrendingUp",
        permissions: ["INCOME_EXPENSE_VIEW"],
      },
      {
        label: "Cash Flow",
        href: "/cash-flow",
        icon: "DollarSign",
        permissions: ["CASH_FLOW_VIEW"],
      },
      {
        label: "Chart of Accounts",
        href: "/accounting/chart-of-accounts",
        icon: "FolderTree",
        permissions: ["CHART_OF_ACCOUNTS_VIEW"],
      },
      {
        label: "Journal Entries",
        href: "/accounting/journal-entries",
        icon: "BookOpen",
        permissions: ["JOURNAL_ENTRIES_VIEW"],
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
        permissions: ["SALES_REPORTS_VIEW"],
      },
      {
        label: "Purchase Reports",
        href: "/reports/purchases",
        icon: "BarChart3",
        permissions: ["PURCHASE_REPORTS_VIEW"],
      },
      {
        label: "Inventory Reports",
        href: "/reports/inventory",
        icon: "Package",
        permissions: ["INVENTORY_REPORTS_VIEW"],
      },
      {
        label: "Tax / VAT Reports",
        href: "/reports/tax",
        icon: "FileText",
        permissions: ["TAX_REPORTS_VIEW"],
      },
      {
        label: "Receivable Aging",
        href: "/accounts-receivable/aging",
        icon: "PieChart",
        permissions: ["AGING_REPORTS_VIEW"],
      },
      {
        label: "Payable Aging",
        href: "/accounts-payable/aging",
        icon: "PieChart",
        permissions: ["AGING_REPORTS_VIEW"],
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
        permissions: ["ROLES_MANAGE"],
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
        permissions: ["TEMPLATES_VIEW"],
      },
      {
        label: "Branches",
        href: "/settings/branches",
        icon: "Store",
        permissions: ["BRANCHES_VIEW"],
      },
      {
        label: "Stores",
        href: "/settings?tab=stores",
        icon: "Warehouse",
        permissions: ["STORES_VIEW"],
      },
      {
        label: "Theme & Branding",
        href: "/settings?tab=theme",
        icon: "Palette",
        permissions: ["BRANDING_MANAGE"],
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
