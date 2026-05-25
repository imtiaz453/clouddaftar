import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { companyId } = user;

    const now = new Date();

    const [unpaidSales, unpaidPurchases] = await Promise.all([
      prisma.sale.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
          paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
        },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.purchase.findMany({
        where: {
          companyId,
          deletedAt: null,
          paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
        },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    function daysOverdue(date: Date): number {
      return Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    }

    function getBucket(days: number): string {
      if (days <= 0) return "CURRENT";
      if (days <= 30) return "1-30 DAYS";
      if (days <= 60) return "31-60 DAYS";
      if (days <= 90) return "61-90 DAYS";
      return "90+ DAYS";
    }

    const buckets = ["CURRENT", "1-30 DAYS", "31-60 DAYS", "61-90 DAYS", "90+ DAYS"];

    const receivableBuckets: Record<string, { total: number; count: number; invoices: any[] }> = {};
    const payableBuckets: Record<string, { total: number; count: number; invoices: any[] }> = {};
    for (const b of buckets) {
      receivableBuckets[b] = { total: 0, count: 0, invoices: [] };
      payableBuckets[b] = { total: 0, count: 0, invoices: [] };
    }

    for (const sale of unpaidSales) {
      const days = daysOverdue(sale.createdAt);
      const bucket = getBucket(days);
      receivableBuckets[bucket].total += Number(sale.due);
      receivableBuckets[bucket].count += 1;
      receivableBuckets[bucket].invoices.push({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customer: sale.customer?.name || "Walk-in",
        total: Number(sale.total),
        due: Number(sale.due),
        date: sale.createdAt.toISOString(),
        daysOverdue: days,
      });
    }

    for (const purchase of unpaidPurchases) {
      const days = daysOverdue(purchase.createdAt);
      const bucket = getBucket(days);
      payableBuckets[bucket].total += Number(purchase.due);
      payableBuckets[bucket].count += 1;
      payableBuckets[bucket].invoices.push({
        id: purchase.id,
        referenceNumber: purchase.referenceNumber,
        supplier: purchase.supplier?.name || "Unknown",
        total: Number(purchase.total),
        due: Number(purchase.due),
        date: purchase.createdAt.toISOString(),
        daysOverdue: days,
      });
    }

    const totalReceivableOverdue = buckets
      .filter((b) => b !== "CURRENT")
      .reduce((sum, b) => sum + receivableBuckets[b].total, 0);

    const totalPayableOverdue = buckets
      .filter((b) => b !== "CURRENT")
      .reduce((sum, b) => sum + payableBuckets[b].total, 0);

    return successResponse({
      asOf: now.toISOString(),
      receivable: {
        buckets: receivableBuckets,
        totalOutstanding: Object.values(receivableBuckets).reduce((s, b) => s + b.total, 0),
        totalOverdue: totalReceivableOverdue,
      },
      payable: {
        buckets: payableBuckets,
        totalOutstanding: Object.values(payableBuckets).reduce((s, b) => s + b.total, 0),
        totalOverdue: totalPayableOverdue,
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch aging report");
  }
}
