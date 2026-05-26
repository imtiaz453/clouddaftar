import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";

const POSTED_STATUSES = ["PENDING", "RECEIVED", "PARTIALLY_RECEIVED"];

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

    const purchases = await prisma.purchase.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true, companyName: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    const daily = new Map<string, { date: string; spend: number; orders: number }>();
    const suppliers = new Map<
      string,
      { id: string; name: string; spend: number; paid: number; due: number; orders: number }
    >();
    const products = new Map<
      string,
      { id: string; name: string; sku: string; quantity: number; spend: number; tax: number }
    >();
    const statuses = new Map<string, { status: string; orders: number; amount: number }>();

    let totalSpend = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let unassignedSupplierOrders = 0;

    for (const purchase of purchases) {
      const total = Number(purchase.total || 0);
      const tax = Number(purchase.tax || 0);
      const discount = Number(purchase.discount || 0);
      const paid = Number(purchase.paid || 0);
      const due = Number(purchase.due || 0);
      totalSpend += total;
      totalTax += tax;
      totalDiscount += discount;
      totalPaid += paid;
      totalDue += due;

      addToMap(
        daily,
        dateKey(purchase.createdAt),
        { date: dateKey(purchase.createdAt), spend: 0, orders: 0 },
        (row) => {
          row.spend = round(Number(row.spend) + total);
          row.orders = Number(row.orders) + 1;
        },
      );

      const supplierId = purchase.supplierId || "unassigned";
      const supplierName =
        purchase.supplier?.companyName ||
        purchase.supplier?.name ||
        (purchase.supplierId ? "Unknown Supplier" : "Unassigned Supplier");
      if (!purchase.supplierId) unassignedSupplierOrders += 1;
      addToMap(
        suppliers,
        supplierId,
        { id: supplierId, name: supplierName, spend: 0, paid: 0, due: 0, orders: 0 },
        (row) => {
          row.spend = round(Number(row.spend) + total);
          row.paid = round(Number(row.paid) + paid);
          row.due = round(Number(row.due) + due);
          row.orders = Number(row.orders) + 1;
        },
      );

      addToMap(
        statuses,
        purchase.status,
        { status: purchase.status, orders: 0, amount: 0 },
        (row) => {
          row.orders = Number(row.orders) + 1;
          row.amount = round(Number(row.amount) + total);
        },
      );

      for (const item of purchase.items) {
        const quantity = Number(item.quantity || 0);
        const spend = Number(item.subtotal || 0) + Number(item.tax || 0);
        const productId = item.productId || item.product?.id || "unknown";
        addToMap(
          products,
          productId,
          {
            id: productId,
            name: item.product?.name || "Unknown Product",
            sku: item.product?.sku || "",
            quantity: 0,
            spend: 0,
            tax: 0,
          },
          (row) => {
            row.quantity = Number(row.quantity) + quantity;
            row.spend = round(Number(row.spend) + spend);
            row.tax = round(Number(row.tax) + Number(item.tax || 0));
          },
        );
      }
    }

    const topSuppliers = [...suppliers.values()].sort((a, b) => b.spend - a.spend);
    const topProducts = [...products.values()].sort((a, b) => b.spend - a.spend);
    const dailyData = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalSpend: round(totalSpend),
          taxableSpend: round(totalSpend - totalTax),
          totalTax: round(totalTax),
          totalDiscount: round(totalDiscount),
          totalPaid: round(totalPaid),
          totalDue: round(totalDue),
          totalOrders: purchases.length,
          averageOrderValue: round(purchases.length ? totalSpend / purchases.length : 0),
          activeSuppliers: topSuppliers.length,
          unassignedSupplierOrders,
        },
        dailyData,
        topSuppliers: topSuppliers.slice(0, 10),
        topProducts: topProducts.slice(0, 10),
        statusData: [...statuses.values()].sort((a, b) => b.amount - a.amount),
        recentPurchases: purchases.slice(0, 15).map((purchase) => ({
          id: purchase.id,
          referenceNumber: purchase.referenceNumber,
          date: purchase.createdAt,
          supplier:
            purchase.supplier?.companyName || purchase.supplier?.name || "Unassigned Supplier",
          status: purchase.status,
          paymentStatus: purchase.paymentStatus,
          total: Number(purchase.total || 0),
          paid: Number(purchase.paid || 0),
          due: Number(purchase.due || 0),
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate purchase report" },
      { status: 500 },
    );
  }
}
