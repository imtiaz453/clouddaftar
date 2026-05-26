import { requireCompanyAuth } from "@/lib/auth-helper";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api";
import {
  createBillingAmountSnapshot,
  getBillingCurrency,
  pricePlanForCurrency,
} from "@/lib/billing-currency";
import { reserveNextBillingInvoiceNumber } from "@/lib/billing-invoice-number";
import {
  addDays,
  isStarterPlan,
  PAID_PLAN_TRIAL_DAYS,
  STARTER_TRIAL_DAYS,
} from "@/lib/subscription-policy";

export async function GET() {
  try {
    const user = await requireCompanyAuth();
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      include: { settings: true },
    });
    if (!company) throw new Error("Company not found");

    const billingCurrency = await getBillingCurrency(company);
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return successResponse(plans.map((plan) => pricePlanForCurrency(plan, billingCurrency)));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch plans");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCompanyAuth();
    const { planId, billingCycle = "MONTHLY" } = await req.json();
    if (!["MONTHLY", "YEARLY"].includes(billingCycle)) {
      throw new Error("Invalid billing cycle");
    }

    const [plan, company] = await Promise.all([
      prisma.subscriptionPlan.findUnique({ where: { id: planId } }),
      prisma.company.findUnique({ where: { id: user.companyId }, include: { settings: true } }),
    ]);
    if (!plan) throw new Error("Plan not found");
    if (!company) throw new Error("Company not found");

    const existing = await prisma.tenantSubscription.findUnique({
      where: { companyId: user.companyId },
      include: { plan: true },
    });

    const now = new Date();
    const periodStart = new Date(now);
    const periodEnd = new Date(now);
    if (billingCycle === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    const starterPlan = isStarterPlan(plan);

    if (existing && starterPlan) {
      throw new Error("Starter is a one-time 30-day trial. Please upgrade to a paid plan.");
    }
    if (
      existing &&
      !isStarterPlan(existing.plan) &&
      existing.endDate &&
      existing.endDate > now &&
      (existing.planId !== planId || existing.billingCycle !== billingCycle)
    ) {
      throw new Error(
        `Your current ${existing.plan.name} plan is active until ${existing.endDate.toLocaleDateString()}. Plan changes are available after the current period ends.`,
      );
    }

    const baseAmount =
      billingCycle === "MONTHLY" ? Number(plan.monthlyPrice) : Number(plan.yearlyPrice);
    const snapshot = await createBillingAmountSnapshot(baseAmount, company);
    const invoiceStatus = starterPlan || snapshot.amount <= 0 ? "CONFIRMED" : "PENDING";

    const result = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await reserveNextBillingInvoiceNumber(tx, user.companyId);
      const subscription =
        existing ??
        (await tx.tenantSubscription.create({
          data: {
            companyId: user.companyId,
            planId,
            billingCycle,
            status: starterPlan || snapshot.amount > 0 ? "TRIAL" : "ACTIVE",
            trialEndDate: starterPlan
              ? addDays(now, STARTER_TRIAL_DAYS)
              : snapshot.amount > 0
                ? addDays(now, PAID_PLAN_TRIAL_DAYS)
                : null,
            endDate: starterPlan ? addDays(now, STARTER_TRIAL_DAYS) : periodEnd,
            autoRenew: !starterPlan,
          },
        }));

      const invoice = await tx.billingInvoice.create({
        data: {
          invoiceNumber,
          companyId: user.companyId,
          planId,
          subscriptionId: subscription.id,
          billingCycle,
          amount: snapshot.amount,
          currency: snapshot.currency,
          currencySymbol: snapshot.currencySymbol,
          baseAmount: snapshot.baseAmount,
          baseCurrency: snapshot.baseCurrency,
          exchangeRate: snapshot.exchangeRate,
          issueDate: now,
          dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          periodStart,
          periodEnd,
          status: invoiceStatus,
          paidAt: starterPlan || snapshot.amount <= 0 ? now : null,
        },
      });

      const activatedSubscription =
        existing && snapshot.amount <= 0
          ? await tx.tenantSubscription.update({
              where: { companyId: user.companyId },
              data: {
                planId,
                billingCycle,
                status: "ACTIVE",
                trialEndDate: null,
                cancelledAt: null,
                endDate: periodEnd,
                autoRenew: true,
              },
            })
          : subscription;

      return { subscription: activatedSubscription, invoice };
    });

    return successResponse(
      result,
      existing ? "Plan change invoice generated" : "Subscription created",
    );
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create subscription");
  }
}
