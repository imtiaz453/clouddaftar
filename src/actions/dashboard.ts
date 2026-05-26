"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";
import { fillDailySalesGaps } from "@/lib/chart-utils";
import type { DashboardStats } from "@/types";

/** First day of month through end of the same calendar day last month (fair MTD compare). */
function samePeriodLastMonthBounds(now: Date) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const lastDayPrevMonth = new Date(y, m, 0).getDate();
  const day = Math.min(d, lastDayPrevMonth);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m - 1, day, 23, 59, 59, 999);
  return { start, end };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const canViewAllSales = await checkPermission(PERMISSIONS.SALES_VIEW_ALL);

  const userFilter = canViewAllSales ? {} : { createdById: userId };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const priorWindow = samePeriodLastMonthBounds(now);

  const lowStockWhere = {
    companyId,
    isActive: true,
    deletedAt: null,
    stock: { lte: prisma.product.fields.minStock },
  } as const;

  const [
    totalSales,
    totalPurchases,
    totalProducts,
    totalCustomers,
    lowStockCount,
    lowStockItems,
    monthlySalesAgg,
    monthlyPurchasesAgg,
    priorPeriodSalesAgg,
    recentSales,
    company,
  ] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { total: true },
      where: { companyId, deletedAt: null, ...userFilter },
    }),
    prisma.purchase.aggregate({
      _sum: { total: true },
      where: { companyId, deletedAt: null },
    }),
    prisma.product.count({
      where: { companyId, isActive: true, deletedAt: null },
    }),
    prisma.customer.count({
      where: { companyId, isActive: true, deletedAt: null },
    }),
    prisma.product.count({ where: lowStockWhere }),
    prisma.product.findMany({
      where: lowStockWhere,
      select: { id: true, name: true, stock: true, minStock: true },
      orderBy: { stock: "asc" },
      take: 5,
    }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        companyId,
        deletedAt: null,
        status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
        createdAt: { gte: startOfMonth },
        ...userFilter,
      },
    }),
    prisma.purchase.aggregate({
      _sum: { total: true },
      where: {
        companyId,
        deletedAt: null,
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        companyId,
        deletedAt: null,
        status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
        createdAt: { gte: priorWindow.start, lte: priorWindow.end },
        ...userFilter,
      },
    }),
    prisma.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
        ...userFilter,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      include: { settings: true, theme: true },
    }),
  ]);

  const salesTrendRows = canViewAllSales
    ? await prisma.$queryRaw<Array<{ day: Date; amount: unknown }>>(
        Prisma.sql`
          SELECT ("createdAt" AT TIME ZONE 'UTC')::date AS day,
                 COALESCE(SUM("total"), 0) AS amount
          FROM sales
          WHERE "companyId" = ${companyId}
            AND "deletedAt" IS NULL
            AND "status" IN ('COMPLETED', 'PARTIALLY_REFUNDED')
            AND "createdAt" >= ${sixMonthsStart}
          GROUP BY ("createdAt" AT TIME ZONE 'UTC')::date
          ORDER BY day ASC
        `,
      )
    : await prisma.$queryRaw<Array<{ day: Date; amount: unknown }>>(
        Prisma.sql`
          SELECT ("createdAt" AT TIME ZONE 'UTC')::date AS day,
                 COALESCE(SUM("total"), 0) AS amount
          FROM sales
          WHERE "companyId" = ${companyId}
            AND "deletedAt" IS NULL
            AND "status" IN ('COMPLETED', 'PARTIALLY_REFUNDED')
            AND "createdAt" >= ${sixMonthsStart}
            AND "createdById" = ${userId}
          GROUP BY ("createdAt" AT TIME ZONE 'UTC')::date
          ORDER BY day ASC
        `,
      );

  const monthlySales = monthlySalesAgg._sum.total?.toNumber() || 0;
  const monthlySalesPriorPeriod = priorPeriodSalesAgg._sum.total?.toNumber() || 0;

  let monthlySalesChangePct: number | null = null;
  if (monthlySalesPriorPeriod > 0) {
    monthlySalesChangePct =
      ((monthlySales - monthlySalesPriorPeriod) / monthlySalesPriorPeriod) * 100;
  }

  const sparseTrend = salesTrendRows.map((row) => ({
    date: new Date(row.day).toISOString(),
    amount: Number(row.amount),
  }));

  const salesTrend = fillDailySalesGaps(sparseTrend, sixMonthsStart, now);
  const settings = company?.settings;
  const setupChecklist = [
    {
      id: "company-profile",
      title: "Complete company profile",
      description: "Add your contact details, address, logo, currency, and fiscal defaults.",
      href: "/settings",
      completed: Boolean(
        company?.name &&
        company?.email &&
        company?.phone &&
        company?.address &&
        company?.currency &&
        company?.currencySymbol,
      ),
    },
    {
      id: "tax-settings",
      title: "Review tax settings",
      description: "Set tax name/rate and enable FBR or ZATCA if your business requires it.",
      href: "/settings?tab=tax",
      completed: Boolean(
        company?.taxName ||
        Number(company?.taxRate || 0) > 0 ||
        (settings?.taxComplianceMode && settings.taxComplianceMode !== "NONE"),
      ),
    },
    {
      id: "document-numbering",
      title: "Confirm document numbering",
      description: "Review invoice, quotation, sales order, proforma, and purchase order prefixes.",
      href: "/settings",
      completed: Boolean(
        settings?.invoicePrefix &&
        settings?.quotationPrefix &&
        settings?.salesOrderPrefix &&
        settings?.purchaseOrderPrefix,
      ),
    },
    {
      id: "inventory",
      title: "Add inventory or services",
      description: "Create products, services, categories, units, and stock levels.",
      href: "/inventory",
      completed: totalProducts > 0,
    },
    {
      id: "customers",
      title: "Add customers",
      description: "Add saved customers for receivables, statements, and accurate reporting.",
      href: "/customers",
      completed: totalCustomers > 0,
    },
  ];

  return {
    totalSales: totalSales._sum.total?.toNumber() || 0,
    totalPurchases: totalPurchases._sum.total?.toNumber() || 0,
    totalProducts,
    totalCustomers,
    lowStockCount,
    monthlySales,
    monthlySalesPriorPeriod,
    monthlySalesChangePct,
    monthlyPurchases: monthlyPurchasesAgg._sum.total?.toNumber() || 0,
    salesTrend,
    lowStockItems,
    recentSales: recentSales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      total: s.total.toNumber(),
      status: s.status,
      createdAt: s.createdAt,
      customerName: s.customer?.name || "Walk-in",
    })),
    setupChecklist,
  };
}
