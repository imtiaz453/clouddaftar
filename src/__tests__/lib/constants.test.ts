import { describe, it, expect } from "vitest";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  NAV_GROUPS,
  SIDEBAR_BOTTOM_ITEMS,
  getEffectiveUserPermissions,
} from "@/lib/constants";

describe("ROLES", () => {
  it("has all roles defined", () => {
    expect(ROLES.OWNER).toBe("OWNER");
    expect(ROLES.ADMIN).toBe("ADMIN");
    expect(ROLES.MANAGER).toBe("MANAGER");
    expect(ROLES.STAFF).toBe("STAFF");
    expect(ROLES.CASHIER).toBe("CASHIER");
  });
});

describe("ROLE_LABELS", () => {
  it("has labels for all roles", () => {
    Object.keys(ROLES).forEach((role) => {
      expect(ROLE_LABELS[role]).toBeDefined();
    });
  });
});

describe("ROLE_HIERARCHY", () => {
  it("orders roles correctly", () => {
    expect(ROLE_HIERARCHY.OWNER).toBeGreaterThan(ROLE_HIERARCHY.ADMIN);
    expect(ROLE_HIERARCHY.ADMIN).toBeGreaterThan(ROLE_HIERARCHY.MANAGER);
    expect(ROLE_HIERARCHY.MANAGER).toBeGreaterThan(ROLE_HIERARCHY.STAFF);
    expect(ROLE_HIERARCHY.STAFF).toBeGreaterThan(ROLE_HIERARCHY.CASHIER);
  });
});

describe("PERMISSIONS", () => {
  it("has all expected permission keys", () => {
    const expected = [
      "DASHBOARD_VIEW",
      "INVENTORY_VIEW",
      "INVENTORY_CREATE",
      "INVENTORY_EDIT",
      "INVENTORY_DELETE",
      "SALES_VIEW",
      "SALES_CREATE",
      "SALES_EDIT",
      "SALES_DELETE",
      "PURCHASES_VIEW",
      "PURCHASES_CREATE",
      "PURCHASES_EDIT",
      "PURCHASES_DELETE",
      "CUSTOMERS_VIEW",
      "CUSTOMERS_CREATE",
      "CUSTOMERS_EDIT",
      "CUSTOMERS_DELETE",
      "SUPPLIERS_VIEW",
      "SUPPLIERS_CREATE",
      "SUPPLIERS_EDIT",
      "SUPPLIERS_DELETE",
      "REPORTS_VIEW",
      "REPORTS_EXPORT",
      "USERS_VIEW",
      "USERS_INVITE",
      "USERS_MANAGE",
      "SETTINGS_VIEW",
      "SETTINGS_MANAGE",
      "AUDIT_VIEW",
    ];
    expected.forEach((key) => {
      expect(PERMISSIONS).toHaveProperty(key);
    });
  });

  it("all values are dot-separated strings", () => {
    Object.values(PERMISSIONS).forEach((val) => {
      expect(val).toMatch(/^[a-z_]+(?:\.[a-z_]+)+$/);
    });
  });
});

describe("ROLE_PERMISSIONS", () => {
  it("OWNER has all permissions", () => {
    expect(ROLE_PERMISSIONS.OWNER).toEqual(Object.values(PERMISSIONS));
  });

  it("each role has permissions defined", () => {
    Object.keys(ROLES).forEach((role) => {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    });
  });

  it("CASHIER does not receive destructive or administrative permissions", () => {
    const cashierPerms = ROLE_PERMISSIONS.CASHIER;
    expect(cashierPerms).not.toContain(PERMISSIONS.SALES_DELETE);
    expect(cashierPerms).not.toContain(PERMISSIONS.USERS_MANAGE);
    expect(cashierPerms).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
  });

  it("permissions are hierarchical (higher role has >= lower role)", () => {
    const allRoles = ["CASHIER", "STAFF", "MANAGER", "ADMIN", "OWNER"];
    for (let i = 1; i < allRoles.length; i++) {
      const lower = ROLE_PERMISSIONS[allRoles[i - 1]];
      const higher = ROLE_PERMISSIONS[allRoles[i]];
      lower.forEach((perm) => {
        expect(higher).toContain(perm);
      });
    }
  });

  it("only ADMIN and OWNER have SETTINGS_MANAGE", () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(ROLE_PERMISSIONS.MANAGER).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(ROLE_PERMISSIONS.STAFF).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(ROLE_PERMISSIONS.CASHIER).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
  });
});

describe("navigation", () => {
  it("does not expose duplicate sidebar hrefs", () => {
    const hrefs = [
      ...NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
      ...SIDEBAR_BOTTOM_ITEMS.map((item) => item.href),
    ].filter((href) => href !== "#logout");

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("custom permissions", () => {
  it("uses user custom permissions when enabled", () => {
    expect(
      getEffectiveUserPermissions("STAFF", null, {
        mode: "custom",
        permissions: [PERMISSIONS.DASHBOARD_VIEW],
      }),
    ).toEqual([PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE]);
  });

  it("falls back to role permissions when user inherits role", () => {
    expect(
      getEffectiveUserPermissions(
        "CASHIER",
        { CASHIER: [PERMISSIONS.DASHBOARD_VIEW] },
        { mode: "role", permissions: [] },
      ),
    ).toEqual([PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE]);
  });
});
