import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";

function round(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export async function GET(_req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { companyId } = user;

    const products = await prisma.product.findMany({
      where: { companyId, deletedAt: null },
      include: {
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const recentLogs = await prisma.inventoryLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        product: { select: { name: true } },
      },
    });

    const categoryMap = new Map<string, { productCount: number; stockValue: number }>();
    const lowStockAlerts: {
      id: string; name: string; sku: string | null;
      stock: number; minStock: number; stockValue: number;
    }[] = [];

    let activeProducts = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;
    let totalStockValue = 0;
    let totalSellingValue = 0;

    for (const p of products) {
      const stock = Number(p.stock) || 0;
      const purchasePrice = Number(p.purchasePrice) || 0;
      const sellingPrice = Number(p.sellingPrice) || 0;
      const minStock = Number(p.minStock) || 0;

      if (p.isActive) activeProducts++;
      if (stock > 0 && stock <= minStock) lowStockItems++;
      if (stock === 0) outOfStockItems++;

      const stockValue = round(stock * purchasePrice);
      const sellValue = round(stock * sellingPrice);
      totalStockValue += stockValue;
      totalSellingValue += sellValue;

      if (stock > 0 && stock <= minStock) {
        lowStockAlerts.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock,
          minStock,
          stockValue,
        });
      }

      const catName = p.category?.name || "Uncategorized";
      const existing = categoryMap.get(catName) || { productCount: 0, stockValue: 0 };
      existing.productCount++;
      existing.stockValue += stockValue;
      categoryMap.set(catName, existing);
    }

    const categoryBreakdown = [...categoryMap.entries()]
      .map(([category, data]) => ({
        category,
        productCount: data.productCount,
        stockValue: round(data.stockValue),
      }))
      .sort((a, b) => b.stockValue - a.stockValue);

    lowStockAlerts.sort((a, b) => a.stock - b.stock);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalProducts: products.length,
          activeProducts,
          lowStockItems,
          outOfStockItems,
          totalStockValue: round(totalStockValue),
          totalSellingValue: round(totalSellingValue),
          categoriesCount: categoryBreakdown.length,
        },
        categoryBreakdown,
        lowStockAlerts,
        recentMovements: recentLogs.map((log) => ({
          date: log.createdAt.toISOString(),
          product: log.product?.name || "Unknown",
          type: log.type,
          quantity: log.quantity,
          reference: log.reference || "-",
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate inventory report" },
      { status: 500 },
    );
  }
}
