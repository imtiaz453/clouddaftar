export const STARTER_PLAN_CODE = "starter";
export const STARTER_TRIAL_DAYS = 30;
export const PAID_PLAN_TRIAL_DAYS = 14;

export function isStarterPlan(plan: { code?: string | null } | null | undefined) {
  return plan?.code === STARTER_PLAN_CODE;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isExpired(date: Date | string | null | undefined, now = new Date()) {
  return Boolean(date && new Date(date).getTime() <= now.getTime());
}
