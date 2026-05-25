import { describe, expect, it } from "vitest";
import {
  addDays,
  isExpired,
  isStarterPlan,
  STARTER_TRIAL_DAYS,
} from "@/lib/subscription-policy";

describe("subscription policy", () => {
  it("treats starter as the 30-day trial plan", () => {
    expect(STARTER_TRIAL_DAYS).toBe(30);
    expect(isStarterPlan({ code: "starter" })).toBe(true);
    expect(isStarterPlan({ code: "business" })).toBe(false);
  });

  it("calculates and detects expiry dates", () => {
    const now = new Date("2026-05-15T00:00:00.000Z");
    expect(addDays(now, 30).toISOString()).toBe("2026-06-14T00:00:00.000Z");
    expect(isExpired("2026-05-14T23:59:59.000Z", now)).toBe(true);
    expect(isExpired("2026-05-16T00:00:00.000Z", now)).toBe(false);
  });
});
