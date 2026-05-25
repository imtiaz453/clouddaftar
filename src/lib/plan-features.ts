import { PERMISSIONS } from "@/lib/constants";

export type PlanCode = "starter" | "business" | "enterprise";

const WORKSPACE_PERMISSIONS = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.SETTINGS_MANAGE,
  PERMISSIONS.BILLING_VIEW,
];

const STARTER_PERMISSIONS = [
  ...WORKSPACE_PERMISSIONS,
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.INVENTORY_CREATE,
  PERMISSIONS.INVENTORY_EDIT,
  PERMISSIONS.SALES_VIEW,
  PERMISSIONS.SALES_VIEW_ALL,
  PERMISSIONS.SALES_CREATE,
  PERMISSIONS.PURCHASES_VIEW,
  PERMISSIONS.PURCHASES_VIEW_ALL,
  PERMISSIONS.PURCHASES_CREATE,
  PERMISSIONS.PURCHASES_DRAFT,
  PERMISSIONS.CUSTOMERS_VIEW,
  PERMISSIONS.CUSTOMERS_CREATE,
  PERMISSIONS.CUSTOMERS_EDIT,
  PERMISSIONS.EXPENSES_VIEW,
  PERMISSIONS.EXPENSES_CREATE,
  PERMISSIONS.EXPENSES_APPROVE,
];

const BUSINESS_PERMISSIONS = [
  ...STARTER_PERMISSIONS,
  PERMISSIONS.INVENTORY_DELETE,
  PERMISSIONS.SALES_EDIT,
  PERMISSIONS.PURCHASES_EDIT,
  PERMISSIONS.PURCHASES_APPROVE,
  PERMISSIONS.SUPPLIERS_VIEW,
  PERMISSIONS.SUPPLIERS_CREATE,
  PERMISSIONS.SUPPLIERS_EDIT,
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.REPORTS_EXPORT,
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_INVITE,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.EMPLOYEES_VIEW,
  PERMISSIONS.EMPLOYEES_MANAGE,
  PERMISSIONS.PAYROLL_VIEW,
  PERMISSIONS.ACCOUNTING_VIEW,
  PERMISSIONS.ACCOUNTING_MANAGE,
  PERMISSIONS.ACCOUNTING_REPORTS,
];

export const PLAN_PERMISSION_MAP: Record<PlanCode, string[]> = {
  starter: STARTER_PERMISSIONS,
  business: BUSINESS_PERMISSIONS,
  enterprise: Object.values(PERMISSIONS),
};

export function normalizePlanCode(code?: string | null): PlanCode {
  if (code === "business" || code === "enterprise") return code;
  return "starter";
}

export function getPlanAllowedPermissions(code?: string | null): string[] {
  return PLAN_PERMISSION_MAP[normalizePlanCode(code)];
}

export function applyPlanPermissionLimits(permissions: string[], code?: string | null): string[] {
  const allowed = new Set(getPlanAllowedPermissions(code));
  return permissions.filter((permission) => allowed.has(permission));
}

export function roleBypassesPlanLimits(role?: string | null): boolean {
  return role === "OWNER";
}

export function applyPlanPermissionLimitsForRole(
  permissions: string[],
  code?: string | null,
  role?: string | null,
): string[] {
  if (roleBypassesPlanLimits(role)) return permissions;
  return applyPlanPermissionLimits(permissions, code);
}
