import { describe, expect, it } from "vitest";
import { dashboardHref } from "@/lib/dashboard-href";

describe("dashboardHref", () => {
  it("keeps app launcher links unscoped on the unscoped apps page", () => {
    expect(dashboardHref("/apps", "/sales/new")).toBe("/sales/new");
  });

  it("keeps the tenant slug on tenant app launcher links", () => {
    expect(dashboardHref("/demo-pharmacy/apps", "/sales/new")).toBe("/demo-pharmacy/sales/new");
  });
});
