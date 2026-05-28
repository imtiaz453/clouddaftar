import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { getPendingPayments, getInvoicePayments } from "@/actions/admin";
import { successResponse, errorResponse } from "@/lib/api";
import { createCompanyNotification } from "@/lib/audit";
import { sendPushNotificationToCompany } from "@/lib/push";

export async function GET(req: NextRequest) {
  try {
    const page = Number(req.nextUrl.searchParams.get("page")) || 1;
    const filter = req.nextUrl.searchParams.get("filter");
    if (filter === "pending") {
      const data = await getPendingPayments(page);
      return successResponse(data);
    }
    const data = await getInvoicePayments(page);
    return successResponse(data);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch payments");
  }
}

export async function POST(req: Request) {
  try {
    const { invoiceId, action, notes } = await req.json();
    const session = await requireAdmin();

    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: { company: true, subscription: true, payment: true, plan: true },
    });
    if (!invoice) return errorResponse("Invoice not found", 404);

    if (action === "confirm") {
      await prisma.$transaction([
        prisma.billingInvoice.update({
          where: { id: invoiceId },
          data: { status: "CONFIRMED", paidAt: new Date(), verifiedAt: new Date(), verifiedById: session.admin.id, notes },
        }),
        prisma.tenantSubscription.update({
          where: { companyId: invoice.companyId },
          data: {
            planId: invoice.planId,
            billingCycle: invoice.billingCycle,
            status: "ACTIVE",
            trialEndDate: null,
            cancelledAt: null,
            endDate: invoice.periodEnd,
            autoRenew: true,
          },
        }),
        ...(invoice.payment ? [
          prisma.paymentSubmission.update({
            where: { id: invoice.payment.id },
            data: { verifiedById: session.admin.id, verifiedAt: new Date() },
          }),
        ] : []),
      ]);
    } else {
      await prisma.$transaction([
        prisma.billingInvoice.update({
          where: { id: invoiceId },
          data: { status: "REJECTED", notes },
        }),
        ...(invoice.payment ? [
          prisma.paymentSubmission.update({
            where: { id: invoice.payment.id },
            data: { rejectionReason: notes, verifiedById: session.admin.id, verifiedAt: new Date() },
          }),
        ] : []),
      ]);
    }

    await logAdminAction(session.admin.id, action === "confirm" ? "PAYMENT_CONFIRMED" : "PAYMENT_REJECTED", "BillingInvoice", invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
      notes,
    });

    await createCompanyNotification({
      companyId: invoice.companyId,
      title: action === "confirm" ? "Subscription payment approved" : "Subscription payment rejected",
      message:
        action === "confirm"
          ? `${invoice.plan.name} plan is now active until ${invoice.periodEnd.toLocaleDateString()}.`
          : notes || `Payment for invoice ${invoice.invoiceNumber} was rejected. Please review and resubmit.`,
      type: action === "confirm" ? "SUCCESS" : "ERROR",
      link: "/billing",
    });

    await sendPushNotificationToCompany(invoice.companyId, {
      title: action === "confirm" ? "Subscription payment approved" : "Subscription payment rejected",
      body:
        action === "confirm"
          ? `${invoice.plan.name} plan is now active`
          : `Payment for invoice ${invoice.invoiceNumber} was rejected`,
      url: "/billing",
    });

    revalidatePath("/cloud-daftar-admin", "layout");

    return successResponse({ success: true }, action === "confirm" ? "Payment confirmed" : "Payment rejected");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to process payment");
  }
}

export async function DELETE(req: Request) {
  try {
    const { invoiceId } = await req.json();
    const session = await requireAdmin();

    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: { payment: true },
    });
    if (!invoice) return errorResponse("Invoice not found", 404);
    if (invoice.status === "CONFIRMED") return errorResponse("Cannot delete a confirmed invoice");

    await prisma.$transaction(async (tx) => {
      if (invoice.payment) {
        await tx.paymentSubmission.delete({ where: { id: invoice.payment.id } });
      }
      await tx.billingInvoice.delete({ where: { id: invoiceId } });
    });

    await logAdminAction(session.admin.id, "INVOICE_DELETED", "BillingInvoice", invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
    });

    revalidatePath("/cloud-daftar-admin", "layout");

    return NextResponse.json({ success: true, message: "Invoice deleted" });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to delete invoice");
  }
}
