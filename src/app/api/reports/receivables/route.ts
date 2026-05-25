import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { companyId } = user;

    const customers = await prisma.customer.findMany({
      where: { companyId, deletedAt: null },
      include: {
        sales: {
          where: {
            deletedAt: null,
            status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
            paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
          },
          select: { id: true, invoiceNumber: true, total: true, paid: true, due: true, createdAt: true, status: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const data = customers
      .map((c) => {
        const totalDue = c.sales.reduce((sum, s) => sum + Number(s.due), 0);
        const totalOutstanding = c.sales.reduce((sum, s) => sum + Number(s.total), 0);
        const totalPaid = c.sales.reduce((sum, s) => sum + Number(s.paid), 0);
        return {
          customerId: c.id,
          customerName: c.name,
          phone: c.phone,
          totalOutstanding,
          totalPaid,
          totalDue,
          invoiceCount: c.sales.length,
          invoices: c.sales.map((s) => ({
            id: s.id,
            invoiceNumber: s.invoiceNumber,
            total: Number(s.total),
            paid: Number(s.paid),
            due: Number(s.due),
            date: s.createdAt.toISOString(),
            status: s.status,
          })),
        };
      })
      .filter((c) => c.totalDue > 0);

    const totalReceivable = data.reduce((sum, c) => sum + c.totalDue, 0);

    return successResponse({
      customers: data,
      totalReceivable,
      totalCustomers: data.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch receivables");
  }
}
