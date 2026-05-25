import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertBillingAmount,
  getExchangeRate,
  pricePlanForCurrency,
} from "@/lib/billing-currency";

describe("billing currency", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 1 when billing currency is already PKR", async () => {
    await expect(getExchangeRate("PKR", "PKR")).resolves.toBe(1);
  });

  it("fetches and applies market exchange rates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: "success", rates: { SAR: 0.01344 } }),
      })),
    );

    await expect(getExchangeRate("PKR", "SAR")).resolves.toBe(0.01344);
    expect(convertBillingAmount(1999, 0.01344)).toBe(26.87);
  });

  it("prices plan amounts in the tenant currency", () => {
    const plan = {
      id: "plan_1",
      name: "Business",
      code: "business",
      description: null,
      monthlyPrice: 1999,
      yearlyPrice: 19990,
      userLimit: 10,
      storageLimitMB: 1000,
      features: [],
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const priced = pricePlanForCurrency(plan, {
      currency: "SAR",
      currencySymbol: "SAR",
      currencyPosition: "left",
      exchangeRate: 0.01344,
    });

    expect(priced.monthlyPrice).toBe(26.87);
    expect(priced.baseMonthlyPrice).toBe(1999);
    expect(priced.currency).toBe("SAR");
  });
});
