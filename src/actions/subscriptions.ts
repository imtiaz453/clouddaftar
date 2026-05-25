"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog } from "@/lib/audit";
import { createBillingAmountSnapshot } from "@/lib/billing-currency";
import { addDays, isStarterPlan, PAID_PLAN_TRIAL_DAYS, STARTER_TRIAL_DAYS } from "@/lib/subscription-policy";

export async function getSubscriptionPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getAllPlans() {
  await requireAdmin();
  return prisma.subscriptionPlan.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function createPlan(data: {
  name: string; code: string; description?: string;
  monthlyPrice: number; yearlyPrice: number;
  userLimit: number; storageLimitMB: number;
  features: string[]; sortOrder?: number;
}) {
  await requireAdmin();
  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: data.name, code: data.code,
      description: data.description,
      monthlyPrice: data.monthlyPrice,
      yearlyPrice: data.yearlyPrice,
      userLimit: data.userLimit,
      storageLimitMB: data.storageLimitMB,
      features: JSON.stringify(data.features),
      sortOrder: data.sortOrder || 0,
    },
  });
  revalidatePath("/cloud-daftar-admin/plans");
  return plan;
}

export async function updatePlan(id: string, data: Partial<{
  name: string; description: string; monthlyPrice: number;
  yearlyPrice: number; userLimit: number; storageLimitMB: number;
  features: string[]; isActive: boolean; sortOrder: number;
}>) {
  await requireAdmin();
  const updateData: any = { ...data };
  if (data.features) updateData.features = JSON.stringify(data.features);
  const plan = await prisma.subscriptionPlan.update({ where: { id }, data: updateData });
  revalidatePath("/cloud-daftar-admin/plans");
  return plan;
}

export async function getCompanySubscription(companyId?: string) {
  const user = await requireCompanyAuth();
  const cId = companyId || user.companyId;
  return prisma.tenantSubscription.findUnique({
    where: { companyId: cId },
    include: { plan: true },
  });
}

export async function createSubscription(data: {
  companyId: string; planId: string; billingCycle: "MONTHLY" | "YEARLY";
}) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: data.planId } });
  if (!plan) throw new Error("Plan not found");

  const existing = await prisma.tenantSubscription.findUnique({ where: { companyId: data.companyId } });
  if (existing) throw new Error("Company already has a subscription");

  const now = new Date();
  const endDate = new Date(now);
  if (data.billingCycle === "MONTHLY") endDate.setMonth(endDate.getMonth() + 1);
  else endDate.setFullYear(endDate.getFullYear() + 1);
  const starterPlan = isStarterPlan(plan);
  const trialEndDate = starterPlan ? addDays(now, STARTER_TRIAL_DAYS) : addDays(now, PAID_PLAN_TRIAL_DAYS);

  const subscription = await prisma.tenantSubscription.create({
    data: {
      companyId: data.companyId,
      planId: data.planId,
      billingCycle: data.billingCycle,
      status: "TRIAL",
      trialEndDate,
      endDate: starterPlan ? trialEndDate : endDate,
      autoRenew: !starterPlan,
    },
  });
  return subscription;
}

export async function changeSubscriptionPlan(companyId: string, planId: string) {
  const user = await requireCompanyAuth();
  const subscription = await prisma.tenantSubscription.findUnique({ where: { companyId } });
  if (!subscription) throw new Error("No active subscription");

  const updated = await prisma.tenantSubscription.update({
    where: { companyId },
    data: { planId },
  });
  await createAuditLog({
    userId: user.id, companyId, action: "UPDATE",
    entity: "Subscription", entityId: subscription.id,
    metadata: { previousPlanId: subscription.planId, newPlanId: planId },
  });
  return updated;
}

export async function updateSubscriptionStatus(
  companyId: string, status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "SUSPENDED" | "TRIAL"
) {
  return prisma.tenantSubscription.update({
    where: { companyId },
    data: { status },
  });
}

export async function generateInvoice(companyId: string) {
  const user = await requireCompanyAuth();
  const subscription = await prisma.tenantSubscription.findUnique({
    where: { companyId },
    include: { plan: true, company: { include: { settings: true } } },
  });
  if (!subscription) throw new Error("No subscription found");

  const count = await prisma.billingInvoice.count();
  const invoiceNumber = `SUB-${String(count + 1).padStart(5, "0")}`;

  const now = new Date();
  const periodStart = new Date(now);
  const periodEnd = new Date(now);
  if (subscription.billingCycle === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
  else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const baseAmount = subscription.billingCycle === "MONTHLY"
    ? Number(subscription.plan.monthlyPrice)
    : Number(subscription.plan.yearlyPrice);
  const snapshot = await createBillingAmountSnapshot(baseAmount, subscription.company);

  const invoice = await prisma.billingInvoice.create({
    data: {
      invoiceNumber,
      companyId,
      planId: subscription.planId,
      subscriptionId: subscription.id,
      billingCycle: subscription.billingCycle,
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
    },
  });

  await createAuditLog({
    userId: user.id, companyId, action: "CREATE",
    entity: "BillingInvoice", entityId: invoice.id,
    metadata: { invoiceNumber, amount: snapshot.amount, currency: snapshot.currency, baseAmount: snapshot.baseAmount, baseCurrency: snapshot.baseCurrency, exchangeRate: snapshot.exchangeRate },
  });

  return invoice;
}

export async function getCompanyInvoices(companyId?: string) {
  const user = await requireCompanyAuth();
  const cId = companyId || user.companyId;
  return prisma.billingInvoice.findMany({
    where: { companyId: cId },
    include: { plan: true, payment: true },
    orderBy: { createdAt: "desc" },
  });
}
