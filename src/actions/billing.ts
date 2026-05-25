"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createNotification } from "@/lib/audit";
import { getBillingCurrency, pricePlanForCurrency } from "@/lib/billing-currency";

export async function getBillingOverview() {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const [company, subscription] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, include: { settings: true } }),
    prisma.tenantSubscription.findUnique({
      where: { companyId },
      include: { plan: true },
    }),
  ]);
  if (!company) throw new Error("Company not found");
  const billingCurrency = await getBillingCurrency(company);
  const pricedSubscription = subscription
    ? { ...subscription, plan: pricePlanForCurrency(subscription.plan, billingCurrency) }
    : null;

  const invoices = await prisma.billingInvoice.findMany({
    where: { companyId },
    include: { plan: true, payment: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { subscription: pricedSubscription, invoices, billingCurrency };
}

export async function submitPayment(
  invoiceId: string,
  data: { transactionRef?: string; paymentMethod: string; screenshotData?: string; notes?: string }
) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: invoiceId, companyId },
  });
  if (!invoice) throw new Error("Invoice not found");

  const existing = await prisma.paymentSubmission.findUnique({
    where: { invoiceId },
  });
  if (existing) throw new Error("Payment already submitted for this invoice");

  const [payment] = await prisma.$transaction([
    prisma.paymentSubmission.create({
      data: {
        invoiceId,
        companyId,
        transactionRef: data.transactionRef,
        paymentMethod: data.paymentMethod,
        screenshotUrl: data.screenshotData,
        notes: data.notes,
        submittedAt: new Date(),
      },
    }),
    prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: { status: "SUBMITTED" },
    }),
    prisma.systemNotification.create({
      data: {
        title: "New Payment Submitted",
        message: `Invoice ${invoice.invoiceNumber} payment submitted by ${user.companyId}`,
        type: "info",
        link: `/cloud-daftar-admin/payments`,
      },
    }),
  ]);

  await createNotification({
    companyId,
    userId: user.id,
    title: "Payment submitted",
    message: `Invoice ${invoice.invoiceNumber} is waiting for admin verification.`,
    type: "INFO",
    link: "/billing",
  });

  revalidatePath("/billing");
  return payment;
}

export async function getInvoicePdf(invoiceId: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      company: true,
      plan: true,
      payment: true,
    },
  });
  if (!invoice) throw new Error("Invoice not found");

  return invoice;
}

export async function getUnpaidInvoices() {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  return prisma.billingInvoice.findMany({
    where: {
      companyId,
      status: { in: ["PENDING", "SUBMITTED"] },
    },
    include: { plan: true },
    orderBy: { dueDate: "asc" },
  });
}
