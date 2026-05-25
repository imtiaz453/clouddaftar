import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBillingAmountSnapshot } from "@/lib/billing-currency";
import { STARTER_PLAN_CODE } from "@/lib/subscription-policy";

export async function GET(req: NextRequest) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { renewed: 0, suspended: 0, starterSuspended: 0, errors: [] as string[] };

  try {
    // 0. Starter is a 30-day trial only. Suspend it when the trial window ends.
    const expiredStarterTrials = await prisma.tenantSubscription.findMany({
      where: {
        status: { in: ["TRIAL", "ACTIVE"] },
        plan: { code: STARTER_PLAN_CODE },
        OR: [{ trialEndDate: { lte: new Date() } }, { endDate: { lte: new Date() } }],
      },
      include: { company: true },
    });

    for (const sub of expiredStarterTrials) {
      try {
        await prisma.$transaction([
          prisma.tenantSubscription.update({
            where: { id: sub.id },
            data: { status: "SUSPENDED", autoRenew: false },
          }),
          prisma.systemNotification.create({
            data: {
              title: "Starter Trial Suspended",
              message: `${sub.company?.name || sub.companyId} reached the 30-day Starter trial limit`,
              type: "warning",
              link: `/cloud-daftar-admin/tenants`,
            },
          }),
        ]);
        results.starterSuspended++;
      } catch (e) {
        results.errors.push(`Starter suspend ${sub.id}: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    // 1. Auto-renew: find ACTIVE subscriptions past their endDate with autoRenew enabled
    const expiring = await prisma.tenantSubscription.findMany({
      where: {
        status: "ACTIVE",
        autoRenew: true,
        endDate: { lte: new Date() },
      },
      include: { plan: true, company: { include: { settings: true } } },
    });

    for (const sub of expiring) {
      try {
        const now = new Date();
        const periodStart = new Date(now);
        const periodEnd = new Date(now);
        if (sub.billingCycle === "MONTHLY") periodEnd.setMonth(periodEnd.getMonth() + 1);
        else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

        const count = await prisma.billingInvoice.count();
        const invoiceNumber = `SUB-${String(count + 1).padStart(5, "0")}`;
        const baseAmount = sub.billingCycle === "MONTHLY"
          ? Number(sub.plan.monthlyPrice)
          : Number(sub.plan.yearlyPrice);
        const snapshot = await createBillingAmountSnapshot(baseAmount, sub.company);

        await prisma.$transaction([
          prisma.billingInvoice.create({
            data: {
              invoiceNumber,
              companyId: sub.companyId,
              planId: sub.planId,
              subscriptionId: sub.id,
              billingCycle: sub.billingCycle,
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
          }),
          prisma.tenantSubscription.update({
            where: { id: sub.id },
            data: { endDate: periodEnd },
          }),
          prisma.systemNotification.create({
            data: {
              title: "Subscription Renewed",
              message: `Invoice ${invoiceNumber} generated for ${sub.company?.name || sub.companyId}`,
              type: "info",
              link: `/billing`,
            },
          }),
        ]);

        results.renewed++;
      } catch (e) {
        results.errors.push(`Renew ${sub.id}: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }

    // 2. Auto-suspend: find PENDING invoices where dueDate + 7 days has passed
    const overdueInvoices = await prisma.billingInvoice.findMany({
      where: {
        status: "PENDING",
        dueDate: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: { subscription: true, company: true },
    });

    for (const inv of overdueInvoices) {
      try {
        if (inv.subscription && inv.subscription.status !== "SUSPENDED") {
          await prisma.$transaction([
            prisma.tenantSubscription.update({
              where: { id: inv.subscriptionId },
              data: { status: "SUSPENDED" },
            }),
            prisma.billingInvoice.update({
              where: { id: inv.id },
              data: { status: "EXPIRED" },
            }),
            prisma.systemNotification.create({
              data: {
                title: "Account Suspended",
                message: `${inv.company?.name || inv.companyId} suspended – invoice ${inv.invoiceNumber} unpaid for over 7 days`,
                type: "warning",
                link: `/cloud-daftar-admin/tenants`,
              },
            }),
          ]);
          results.suspended++;
        }
      } catch (e) {
        results.errors.push(`Suspend ${inv.id}: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cron failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...results });
}
