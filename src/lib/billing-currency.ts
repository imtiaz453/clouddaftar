import type { Company, CompanySettings, SubscriptionPlan } from "@prisma/client";

const BASE_BILLING_CURRENCY = "PKR";
const BASE_BILLING_SYMBOL = "Rs";
const EXCHANGE_RATE_URL = "https://open.er-api.com/v6/latest";

export interface BillingCurrency {
  currency: string;
  currencySymbol: string;
  currencyPosition: "left" | "right";
  exchangeRate: number;
}

type CompanyWithSettings = Pick<Company, "currency" | "currencySymbol"> & {
  settings?: Pick<CompanySettings, "currencyPosition"> | null;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function getExchangeRate(from: string, to: string): Promise<number> {
  const base = (from || BASE_BILLING_CURRENCY).toUpperCase();
  const target = (to || BASE_BILLING_CURRENCY).toUpperCase();
  if (base === target) return 1;

  const res = await fetch(`${EXCHANGE_RATE_URL}/${encodeURIComponent(base)}`, {
    next: { revalidate: 60 * 60 * 6 },
  });
  if (!res.ok) throw new Error(`Unable to fetch exchange rate for ${base} to ${target}`);

  const data = await res.json();
  const rate = Number(data?.rates?.[target]);
  if (data?.result !== "success" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Exchange rate unavailable for ${base} to ${target}`);
  }

  return rate;
}

export async function getBillingCurrency(company: CompanyWithSettings): Promise<BillingCurrency> {
  const currency = company.currency || BASE_BILLING_CURRENCY;
  return {
    currency,
    currencySymbol: company.currencySymbol || BASE_BILLING_SYMBOL,
    currencyPosition: company.settings?.currencyPosition === "right" ? "right" : "left",
    exchangeRate: await getExchangeRate(BASE_BILLING_CURRENCY, currency),
  };
}

export function convertBillingAmount(baseAmount: number, exchangeRate: number) {
  return roundMoney(baseAmount * exchangeRate);
}

export function pricePlanForCurrency<T extends SubscriptionPlan>(
  plan: T,
  billingCurrency: BillingCurrency,
) {
  const monthlyBasePrice = Number(plan.monthlyPrice);
  const yearlyBasePrice = Number(plan.yearlyPrice);

  return {
    ...plan,
    baseCurrency: BASE_BILLING_CURRENCY,
    baseCurrencySymbol: BASE_BILLING_SYMBOL,
    baseMonthlyPrice: monthlyBasePrice,
    baseYearlyPrice: yearlyBasePrice,
    monthlyPrice: convertBillingAmount(monthlyBasePrice, billingCurrency.exchangeRate),
    yearlyPrice: convertBillingAmount(yearlyBasePrice, billingCurrency.exchangeRate),
    currency: billingCurrency.currency,
    currencySymbol: billingCurrency.currencySymbol,
    exchangeRate: billingCurrency.exchangeRate,
  };
}

export async function createBillingAmountSnapshot(
  baseAmount: number,
  company: CompanyWithSettings,
) {
  const billingCurrency = await getBillingCurrency(company);
  return {
    baseAmount: roundMoney(baseAmount),
    baseCurrency: BASE_BILLING_CURRENCY,
    amount: convertBillingAmount(baseAmount, billingCurrency.exchangeRate),
    currency: billingCurrency.currency,
    currencySymbol: billingCurrency.currencySymbol,
    exchangeRate: billingCurrency.exchangeRate,
  };
}
