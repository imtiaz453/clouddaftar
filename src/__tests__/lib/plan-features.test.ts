import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/constants";
import {
  applyPlanPermissionLimits,
  applyPlanPermissionLimitsForRole,
  getPlanAllowedPermissions,
  normalizePlanCode,
} from "@/lib/plan-features";

describe("plan feature gates", () => {
  it("defaults unknown or trial-only tenants to starter limits", () => {
    expect(normalizePlanCode(null)).toBe("starter");
    expect(normalizePlanCode("custom")).toBe("starter");
  });

  it("limits starter tenants to the starter feature set", () => {
    const permissions = applyPlanPermissionLimits(Object.values(PERMISSIONS), "starter");

    expect(permissions).toContain(PERMISSIONS.INVENTORY_VIEW);
    expect(permissions).toContain(PERMISSIONS.SALES_CREATE);
    expect(permissions).toContain(PERMISSIONS.PURCHASES_VIEW);
    expect(permissions).toContain(PERMISSIONS.CUSTOMERS_VIEW);
    expect(permissions).not.toContain(PERMISSIONS.SUPPLIERS_VIEW);
    expect(permissions).not.toContain(PERMISSIONS.REPORTS_VIEW);
    expect(permissions).not.toContain(PERMISSIONS.USERS_MANAGE);
    expect(permissions).not.toContain(PERMISSIONS.ACCOUNTING_VIEW);
  });

  it("keeps tenant owners on full role permissions so the first owner can access all modules", () => {
    const permissions = applyPlanPermissionLimitsForRole(
      Object.values(PERMISSIONS),
      "starter",
      "OWNER",
    );

    expect(permissions).toContain(PERMISSIONS.SUPPLIERS_VIEW);
    expect(permissions).toContain(PERMISSIONS.REPORTS_VIEW);
    expect(permissions).toContain(PERMISSIONS.USERS_MANAGE);
    expect(permissions).toContain(PERMISSIONS.ACCOUNTING_VIEW);
  });

  it("adds business features without granting enterprise-only reconcile/audit", () => {
    const permissions = getPlanAllowedPermissions("business");

    expect(permissions).toContain(PERMISSIONS.SUPPLIERS_VIEW);
    expect(permissions).toContain(PERMISSIONS.REPORTS_VIEW);
    expect(permissions).toContain(PERMISSIONS.USERS_MANAGE);
    expect(permissions).toContain(PERMISSIONS.ACCOUNTING_VIEW);
    expect(permissions).toContain(PERMISSIONS.ACCOUNTING_REPORTS);
    expect(permissions).not.toContain(PERMISSIONS.ACCOUNTING_RECONCILE);
    expect(permissions).not.toContain(PERMISSIONS.AUDIT_VIEW);
  });

  it("allows enterprise tenants all permissions", () => {
    expect(getPlanAllowedPermissions("enterprise")).toEqual(Object.values(PERMISSIONS));
  });
});
