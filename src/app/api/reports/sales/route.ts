import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";

const POSTED_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"];

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

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addToMap<T extends Record<string, unknown>>(
  map: Map<string, T>,
  key: string,
  seed: T,
  update: (row: T) => void,
) {
  const row = map.get(key) || seed;
  update(row);
  map.set(key, row);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const searchParams = req.nextUrl.searchParams;
    const dateFrom = parseLocalDay(searchParams.get("dateFrom"), "start");
    const dateTo = parseLocalDay(searchParams.get("dateTo"), "end");
    const status = searchParams.get("status") || "POSTED";

    const where: Record<string, unknown> = {
      companyId: user.companyId,
      deletedAt: null,
    };
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }
    if (status === "POSTED") where.status = { in: POSTED_STATUSES };
    else if (status !== "ALL") where.status = status;

    const sales = await prisma.sale.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, companyName: true, phone: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, purchasePrice: true, isService: true },
            },
          },
        },
      },
    });

    const daily = new Map<string, { date: string; revenue: number; orders: number }>();
    const customers = new Map<
      string,
      { id: string; name: string; revenue: number; paid: number; due: number; orders: number }
    >();
    const products = new Map<
      string,
      { id: string; name: string; sku: string; quantity: number; revenue: number; tax: number }
    >();
    const statuses = new Map<string, { status: string; orders: number; amount: number }>();

    let totalRevenue = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let cogs = 0;
    let walkInOrders = 0;

    for (const sale of sales) {
      const total = Number(sale.total || 0);
      const tax = Number(sale.tax || 0);
      const discount = Number(sale.discount || 0);
      const paid = Number(sale.paid || 0);
      const due = Number(sale.due || 0);
      totalRevenue += total;
      totalTax += tax;
      totalDiscount += discount;
      totalPaid += paid;
      totalDue += due;

      addToMap(
        daily,
        dateKey(sale.createdAt),
        { date: dateKey(sale.createdAt), revenue: 0, orders: 0 },
        (row) => {
          row.revenue = round(Number(row.revenue) + total);
          row.orders = Number(row.orders) + 1;
        },
      );

      const customerId = sale.customerId || "walk-in";
      const customerName =
        sale.customer?.companyName ||
        sale.customer?.name ||
        (sale.customerId ? "Unknown Customer" : "Walk-in Customer");
      if (!sale.customerId) walkInOrders += 1;
      addToMap(
        customers,
        customerId,
        { id: customerId, name: customerName, revenue: 0, paid: 0, due: 0, orders: 0 },
        (row) => {
          row.revenue = round(Number(row.revenue) + total);
          row.paid = round(Number(row.paid) + paid);
          row.due = round(Number(row.due) + due);
          row.orders = Number(row.orders) + 1;
        },
      );

      addToMap(statuses, sale.status, { status: sale.status, orders: 0, amount: 0 }, (row) => {
        row.orders = Number(row.orders) + 1;
        row.amount = round(Number(row.amount) + total);
      });

      for (const item of sale.items) {
        const quantity = Number(item.quantity || 0);
        const revenue = Number(item.subtotal || 0) + Number(item.tax || 0);
        if (item.product && !item.product.isService) {
          cogs += quantity * Number(item.product.purchasePrice || 0);
        }
        const productId = item.productId || item.product?.id || "unknown";
        addToMap(
          products,
          productId,
          {
            id: productId,
            name: item.product?.name || "Unknown Product",
            sku: item.product?.sku || "",
            quantity: 0,
            revenue: 0,
            tax: 0,
          },
          (row) => {
            row.quantity = Number(row.quantity) + quantity;
            row.revenue = round(Number(row.revenue) + revenue);
            row.tax = round(Number(row.tax) + Number(item.tax || 0));
          },
        );
      }
    }

    const topCustomers = [...customers.values()].sort((a, b) => b.revenue - a.revenue);
    const topProducts = [...products.values()].sort((a, b) => b.revenue - a.revenue);
    const dailyData = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue: round(totalRevenue),
          taxableRevenue: round(totalRevenue - totalTax),
          totalTax: round(totalTax),
          totalDiscount: round(totalDiscount),
          totalPaid: round(totalPaid),
          totalDue: round(totalDue),
          totalOrders: sales.length,
          averageOrderValue: round(sales.length ? totalRevenue / sales.length : 0),
          activeCustomers: topCustomers.length,
          walkInOrders,
          cogs: round(cogs),
          grossProfit: round(totalRevenue - totalTax - cogs),
        },
        dailyData,
        topCustomers: topCustomers.slice(0, 10),
        topProducts: topProducts.slice(0, 10),
        statusData: [...statuses.values()].sort((a, b) => b.amount - a.amount),
        recentSales: sales.slice(0, 15).map((sale) => ({
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          date: sale.createdAt,
          customer: sale.customer?.companyName || sale.customer?.name || "Walk-in Customer",
          status: sale.status,
          paymentStatus: sale.paymentStatus,
          total: Number(sale.total || 0),
          paid: Number(sale.paid || 0),
          due: Number(sale.due || 0),
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate sales report" },
      { status: 500 },
    );
  }
}
