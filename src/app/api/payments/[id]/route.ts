import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { computePaymentStatus, recalculateLedgerBalances } from "@/lib/accounting";
import { createAuditLog } from "@/lib/audit";
import { deleteOperationalJournal } from "@/lib/operational-journals";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyAuth();
    const { companyId } = user;
    const { id } = await params;

    const payment = await prisma.payment.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        allocations: {
          include: {
            sale: { select: { id: true, invoiceNumber: true, total: true, paid: true, due: true } },
            purchase: {
              select: { id: true, referenceNumber: true, total: true, paid: true, due: true },
            },
          },
        },
        createdBy: { select: { name: true } },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch payment" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyAuth();
    const { companyId, id: userId } = user;
    const { id } = await params;

    const payment = await prisma.payment.findFirst({
      where: { id, companyId },
      include: { allocations: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const alloc of payment.allocations) {
        if (alloc.saleId) {
          const sale = await tx.sale.findFirst({ where: { id: alloc.saleId, companyId } });
          if (sale) {
            const newPaid = Math.max(0, Number(sale.paid) - Number(alloc.allocatedAmount));
            const newDue = Number(sale.total) - newPaid;
            const paymentStatus = computePaymentStatus(Number(sale.total), newPaid);
            await tx.sale.update({
              where: { id: alloc.saleId },
              data: { paid: newPaid, due: newDue, paymentStatus },
            });
          }
        }
        if (alloc.purchaseId) {
          const purchase = await tx.purchase.findFirst({
            where: { id: alloc.purchaseId, companyId },
          });
          if (purchase) {
            const newPaid = Math.max(0, Number(purchase.paid) - Number(alloc.allocatedAmount));
            const newDue = Number(purchase.total) - newPaid;
            const paymentStatus = computePaymentStatus(Number(purchase.total), newPaid);
            await tx.purchase.update({
              where: { id: alloc.purchaseId },
              data: { paid: newPaid, due: newDue, paymentStatus },
            });
          }
        }
      }

      await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });
      await tx.ledgerEntry.deleteMany({ where: { referenceId: id, companyId } });
      await deleteOperationalJournal(tx, companyId, `PAYMENT:${id}`);
      await tx.payment.delete({ where: { id } });

      if (payment.customerId) {
        await recalculateLedgerBalances(tx, companyId, payment.customerId, null);
      }
      if (payment.supplierId) {
        await recalculateLedgerBalances(tx, companyId, null, payment.supplierId);
      }
    });

    await createAuditLog({
      userId,
      companyId,
      action: "DELETE",
      entity: "Payment",
      entityId: id,
      metadata: { amount: payment.amount },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete payment" },
      { status: 500 },
    );
  }
}
