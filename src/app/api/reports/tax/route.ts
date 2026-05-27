import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";

function parseLocalDay(value: string | null, boundary: "start" | "end") {
  if (!value) return undefined;
  const parts = value.split("-").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [year, month, day] = parts;
    return boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (boundary === "start") date.setHours(0, 0, 0, 0);
  else date.setHours(23, 59, 59, 999);
  return date;
}

function round(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

const POSTED_SALE_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED"];
const POSTED_PURCHASE_STATUSES = ["PENDING", "RECEIVED", "PARTIALLY_RECEIVED"];

export async function GET(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const searchParams = req.nextUrl.searchParams;
    const dateFrom = parseLocalDay(searchParams.get("dateFrom"), "start");
    const dateTo = parseLocalDay(searchParams.get("dateTo"), "end");

    const dateFilter: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    const [sales, purchases] = await Promise.all([
      prisma.sale.findMany({
        where: {
          companyId: user.companyId,
          deletedAt: null,
          status: { in: POSTED_SALE_STATUSES },
          ...dateFilter,
        } as any,
        include: {
          customer: { select: { name: true, companyName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchase.findMany({
        where: {
          companyId: user.companyId,
          deletedAt: null,
          status: { in: POSTED_PURCHASE_STATUSES },
          ...dateFilter,
        } as any,
        include: {
          supplier: { select: { name: true, companyName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const monthlyMap = new Map<string, { collected: number; paid: number }>();
    function monthKey(d: Date) {
      return d.toISOString().slice(0, 7);
    }

    let taxCollected = 0;
    let taxableSales = 0;
    let taxPaid = 0;
    let taxablePurchases = 0;

    for (const sale of sales) {
      const tax = Number(sale.tax) || 0;
      const total = Number(sale.total) || 0;
      taxCollected += tax;
      taxableSales += total - tax;

      const key = monthKey(sale.createdAt);
      const existing = monthlyMap.get(key) || { collected: 0, paid: 0 };
      existing.collected += tax;
      monthlyMap.set(key, existing);
    }

    for (const purchase of purchases) {
      const tax = Number(purchase.tax) || 0;
      const total = Number(purchase.total) || 0;
      taxPaid += tax;
      taxablePurchases += total - tax;

      const key = monthKey(purchase.createdAt);
      const existing = monthlyMap.get(key) || { collected: 0, paid: 0 };
      existing.paid += tax;
      monthlyMap.set(key, existing);
    }

    const monthlyData = [...monthlyMap.entries()]
      .map(([month, data]) => ({
        month,
        collected: round(data.collected),
        paid: round(data.paid),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const recentTransactions = [
      ...sales.slice(0, 10).map((s) => ({
        date: s.createdAt.toISOString(),
        type: "SALE" as const,
        number: s.invoiceNumber,
        entity: s.customer?.companyName || s.customer?.name || "Walk-in",
        tax: Number(s.tax || 0),
        total: Number(s.total || 0),
      })),
      ...purchases.slice(0, 10).map((p) => ({
        date: p.createdAt.toISOString(),
        type: "PURCHASE" as const,
        number: p.referenceNumber,
        entity: p.supplier?.companyName || p.supplier?.name || "Unknown",
        tax: Number(p.tax || 0),
        total: Number(p.total || 0),
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    const netLiability = round(taxCollected - taxPaid);
    const totalTaxable = taxableSales + taxablePurchases;
    const avgTaxRate = totalTaxable > 0
      ? round(((taxCollected + taxPaid) / (totalTaxable + taxCollected + taxPaid)) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          taxCollected: round(taxCollected),
          taxPaid: round(taxPaid),
          netLiability,
          taxableSales: round(taxableSales),
          taxablePurchases: round(taxablePurchases),
          avgTaxRate,
          salesCount: sales.length,
          purchaseCount: purchases.length,
        },
        monthlyData,
        recentTransactions,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate tax report" },
      { status: 500 },
    );
  }
}
