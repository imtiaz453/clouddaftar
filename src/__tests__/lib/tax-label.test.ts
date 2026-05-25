import { describe, expect, it } from "vitest";
import { resolveTaxLabel } from "@/lib/tax-label";

describe("resolveTaxLabel", () => {
  it("uses VAT for Saudi companies", () => {
    expect(resolveTaxLabel({ country: "SA", taxName: "Tax" })).toBe("VAT");
    expect(resolveTaxLabel({ country: "Saudi Arabia" })).toBe("VAT");
  });

  it("uses VAT for SAR or ZATCA contexts", () => {
    expect(resolveTaxLabel({ currency: "SAR" })).toBe("VAT");
    expect(resolveTaxLabel({ taxComplianceMode: "ZATCA" })).toBe("VAT");
  });

  it("keeps configured tax name for non-Saudi companies", () => {
    expect(resolveTaxLabel({ country: "PK", taxName: "GST" })).toBe("GST");
    expect(resolveTaxLabel({ country: "PK" })).toBe("Tax");
  });
});
