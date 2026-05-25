import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import {
  computePaymentStatus,
  createLedgerEntry,
  recalculateLedgerBalances,
} from "@/lib/accounting";
import {
  postCustomerPaymentJournal,
  postSupplierPaymentJournal,
} from "@/lib/operational-journals";
import { createAuditLog } from "@/lib/audit";
import { paymentCreateSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { companyId } = user;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const customerId = searchParams.get("customerId");
    const supplierId = searchParams.get("supplierId");

    const where: any = { companyId };
    if (customerId) where.customerId = customerId;
    if (supplierId) where.supplierId = supplierId;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          allocations: {
            include: {
              sale: { select: { id: true, invoiceNumber: true, total: true } },
              purchase: { select: { id: true, referenceNumber: true, total: true } },
            },
          },
          createdBy: { select: { name: true } },
        },
        orderBy: { paymentDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: payments,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch payments" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { companyId, id: userId } = user;

    const body = await req.json();
    const parsed = paymentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid payment data" },
        { status: 400 },
      );
    }

    const {
      customerId,
      supplierId,
      amount,
      paymentMethod,
      reference,
      notes,
      paymentDate,
      allocations,
    } = parsed.data;

    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    if (Math.abs(totalAllocated - amount) > 0.01) {
      return NextResponse.json(
        { error: "Allocation total must match payment amount" },
        { status: 400 },
      );
    }

    const payment = await prisma.$transaction(async (tx) => {
      if (customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: customerId, companyId, deletedAt: null, isActive: true },
        });
        if (!customer) throw new Error("Customer not found");

        const saleIds = allocations.map((allocation) => allocation.saleId!);
        const sales = await tx.sale.findMany({
          where: {
            id: { in: saleIds },
            companyId,
            customerId,
            deletedAt: null,
            status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
          },
        });
        if (sales.length !== new Set(saleIds).size) {
          throw new Error("One or more invoices are invalid for this customer");
        }

        const salesById = new Map(sales.map((sale) => [sale.id, sale]));
        for (const allocation of allocations) {
          const sale = salesById.get(allocation.saleId!);
          if (!sale || allocation.allocatedAmount - Number(sale.due) > 0.01) {
            throw new Error("Payment allocation exceeds invoice balance");
          }
        }
      }

      if (supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: supplierId, companyId, deletedAt: null, isActive: true },
        });
        if (!supplier) throw new Error("Supplier not found");

        const purchaseIds = allocations.map((allocation) => allocation.purchaseId!);
        const purchases = await tx.purchase.findMany({
          where: {
            id: { in: purchaseIds },
            companyId,
            supplierId,
            deletedAt: null,
            status: { notIn: ["DRAFT", "CANCELLED"] },
          },
        });
        if (purchases.length !== new Set(purchaseIds).size) {
          throw new Error("One or more purchases are invalid for this supplier");
        }

        const purchasesById = new Map(purchases.map((purchase) => [purchase.id, purchase]));
        for (const allocation of allocations) {
          const purchase = purchasesById.get(allocation.purchaseId!);
          if (!purchase || allocation.allocatedAmount - Number(purchase.due) > 0.01) {
            throw new Error("Payment allocation exceeds purchase balance");
          }
        }
      }

      const payment = await tx.payment.create({
        data: {
          companyId,
          customerId: customerId || null,
          supplierId: supplierId || null,
          amount,
          paymentMethod: paymentMethod || "CASH",
          reference,
          notes,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          createdById: userId,
        },
      });

      for (const alloc of allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            saleId: alloc.saleId || null,
            purchaseId: alloc.purchaseId || null,
            allocatedAmount: alloc.allocatedAmount,
          },
        });

        if (alloc.saleId) {
          const sale = await tx.sale.findUnique({ where: { id: alloc.saleId } });
          if (sale) {
            const newPaid = Number(sale.paid) + alloc.allocatedAmount;
            const newDue = Math.max(0, Number(sale.total) - newPaid);
            const paymentStatus = computePaymentStatus(Number(sale.total), newPaid);
            await tx.sale.update({
              where: { id: alloc.saleId },
              data: { paid: newPaid, due: newDue, paymentStatus },
            });
          }
        }

        if (alloc.purchaseId) {
          const purchase = await tx.purchase.findUnique({ where: { id: alloc.purchaseId } });
          if (purchase) {
            const newPaid = Number(purchase.paid) + alloc.allocatedAmount;
            const newDue = Math.max(0, Number(purchase.total) - newPaid);
            const paymentStatus = computePaymentStatus(Number(purchase.total), newPaid);
            await tx.purchase.update({
              where: { id: alloc.purchaseId },
              data: { paid: newPaid, due: newDue, paymentStatus },
            });
          }
        }
      }

      if (customerId) {
        await createLedgerEntry(
          {
            companyId,
            customerId,
            type: "PAYMENT",
            referenceId: payment.id,
            referenceNumber: reference || payment.id,
            debit: 0,
            credit: amount,
            description: `Payment received - ${reference || ""}`,
            createdById: userId,
          },
          tx,
        );
        await recalculateLedgerBalances(tx, companyId, customerId, null);
        await postCustomerPaymentJournal(tx, {
          companyId,
          userId,
          paymentId: payment.id,
          referenceNumber: reference || payment.id,
          customerId,
          amount,
          paymentMethod,
          date: payment.paymentDate,
        });
      }

      if (supplierId) {
        await createLedgerEntry(
          {
            companyId,
            supplierId,
            type: "PAYMENT",
            referenceId: payment.id,
            referenceNumber: reference || payment.id,
            debit: 0,
            credit: amount,
            description: `Payment made - ${reference || ""}`,
            createdById: userId,
          },
          tx,
        );
        await recalculateLedgerBalances(tx, companyId, null, supplierId);
        await postSupplierPaymentJournal(tx, {
          companyId,
          userId,
          paymentId: payment.id,
          referenceNumber: reference || payment.id,
          supplierId,
          amount,
          paymentMethod,
          date: payment.paymentDate,
        });
      }

      return payment;
    });

    await createAuditLog({
      userId,
      companyId,
      action: "CREATE",
      entity: "Payment",
      entityId: payment.id,
      metadata: { amount, customerId, supplierId, allocationsCount: allocations.length },
    });

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment" },
      { status: 500 },
    );
  }
}
