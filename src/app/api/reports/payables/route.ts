import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { companyId } = user;

    const suppliers = await prisma.supplier.findMany({
      where: { companyId, deletedAt: null },
      include: {
        purchases: {
          where: { deletedAt: null, paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } },
          select: { id: true, referenceNumber: true, total: true, paid: true, due: true, createdAt: true, status: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const data = suppliers
      .map((s) => {
        const totalDue = s.purchases.reduce((sum, p) => sum + Number(p.due), 0);
        const totalOutstanding = s.purchases.reduce((sum, p) => sum + Number(p.total), 0);
        const totalPaid = s.purchases.reduce((sum, p) => sum + Number(p.paid), 0);
        return {
          supplierId: s.id,
          supplierName: s.name,
          phone: s.phone,
          totalOutstanding,
          totalPaid,
          totalDue,
          invoiceCount: s.purchases.length,
          invoices: s.purchases.map((p) => ({
            id: p.id,
            referenceNumber: p.referenceNumber,
            total: Number(p.total),
            paid: Number(p.paid),
            due: Number(p.due),
            date: p.createdAt.toISOString(),
            status: p.status,
          })),
        };
      })
      .filter((s) => s.totalDue > 0);

    const totalPayable = data.reduce((sum, s) => sum + s.totalDue, 0);

    return successResponse({
      suppliers: data,
      totalPayable,
      totalSuppliers: data.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch payables");
  }
}
