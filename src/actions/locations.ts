"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createAuditLog } from "@/lib/audit";
import { ensureDefaultBranchAndWarehouse, ensureDefaultWarehouseLocations } from "@/lib/locations";

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .slice(0, 24);
}

export async function getBranches() {
  const { companyId } = await requireCompanyAuth();
  await ensureDefaultBranchAndWarehouse(prisma, companyId);

  return prisma.branch.findMany({
    where: { companyId, deletedAt: null },
    include: { warehouses: { where: { deletedAt: null }, orderBy: { name: "asc" } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getWarehouses(branchId?: string) {
  const { companyId } = await requireCompanyAuth();
  await ensureDefaultBranchAndWarehouse(prisma, companyId);

  return prisma.warehouse.findMany({
    where: { companyId, deletedAt: null, ...(branchId ? { branchId } : {}) },
    include: { branch: { select: { id: true, name: true, code: true } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function createBranch(data: {
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  createDefaultWarehouse?: boolean;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();
  const code = normalizeCode(data.code || data.name);
  if (!data.name.trim()) throw new Error("Branch name is required");
  if (!code) throw new Error("Branch code is required");

  const branch = await prisma.$transaction(async (tx) => {
    const existingCount = await tx.branch.count({ where: { companyId, deletedAt: null } });
    const created = await tx.branch.create({
      data: {
        companyId,
        name: data.name.trim(),
        code,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        isDefault: existingCount === 0,
      },
    });

    if (data.createDefaultWarehouse ?? true) {
      const warehouse = await tx.warehouse.create({
        data: {
          companyId,
          branchId: created.id,
          name: `${created.name} Warehouse`,
          code,
          isDefault: true,
        },
      });
      await ensureDefaultWarehouseLocations(tx, companyId, warehouse);
    }

    return created;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Branch",
    entityId: branch.id,
    metadata: { name: branch.name, code: branch.code },
  });
  revalidatePath("/settings");
  return branch;
}

export async function createWarehouse(data: {
  name: string;
  code?: string;
  branchId?: string;
  isDefault?: boolean;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();
  const code = normalizeCode(data.code || data.name);
  if (!data.name.trim()) throw new Error("Warehouse name is required");
  if (!code) throw new Error("Warehouse code is required");

  if (data.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, companyId, deletedAt: null },
    });
    if (!branch) throw new Error("Branch not found");
  }

  const warehouse = await prisma.$transaction(async (tx) => {
    const created = await tx.warehouse.create({
      data: {
        companyId,
        branchId: data.branchId || null,
        name: data.name.trim(),
        code,
        isDefault: data.isDefault ?? false,
      },
    });
    await ensureDefaultWarehouseLocations(tx, companyId, created);
    return created;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Warehouse",
    entityId: warehouse.id,
    metadata: { name: warehouse.name, code: warehouse.code, branchId: warehouse.branchId },
  });
  revalidatePath("/settings");
  return warehouse;
}

export async function createWarehouseLocation(data: {
  name: string;
  code?: string;
  warehouseId: string;
  parentId?: string;
  type?: string;
  barcode?: string;
  removalStrategy?: string;
  isReplenishable?: boolean;
  isScrapLocation?: boolean;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();
  if (!data.name.trim()) throw new Error("Location name is required");
  if (!data.warehouseId) throw new Error("Warehouse is required");

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: data.warehouseId, companyId, deletedAt: null },
  });
  if (!warehouse) throw new Error("Warehouse not found");

  if (data.parentId) {
    const parent = await prisma.warehouseLocation.findFirst({
      where: { id: data.parentId, companyId, warehouseId: data.warehouseId, deletedAt: null },
    });
    if (!parent) throw new Error("Parent location not found");
  }

  const code = normalizeCode(data.code || `${warehouse.code}-${data.name}`);
  const location = await prisma.warehouseLocation.create({
    data: {
      companyId,
      warehouseId: data.warehouseId,
      parentId: data.parentId || null,
      name: data.name.trim(),
      code,
      type: data.type || "INTERNAL",
      barcode: data.barcode || null,
      removalStrategy: data.removalStrategy || null,
      isReplenishable: data.isReplenishable ?? false,
      isScrapLocation: data.isScrapLocation ?? false,
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "WarehouseLocation",
    entityId: location.id,
    metadata: { name: location.name, code: location.code, warehouseId: location.warehouseId },
  });
  revalidatePath("/inventory/warehouses");
  return location;
}

export async function getWarehouseLocations() {
  const { companyId } = await requireCompanyAuth();
  await ensureDefaultBranchAndWarehouse(prisma, companyId);
  const warehouses = await prisma.warehouse.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, code: true },
  });

  await Promise.all(
    warehouses.map((row) => ensureDefaultWarehouseLocations(prisma, companyId, row)),
  );

  return prisma.warehouseLocation.findMany({
    where: { companyId, deletedAt: null },
    include: {
      warehouse: { include: { branch: { select: { id: true, name: true, code: true } } } },
      parent: { select: { id: true, name: true, code: true } },
      children: { where: { deletedAt: null }, select: { id: true } },
    },
    orderBy: [{ warehouseId: "asc" }, { type: "asc" }, { name: "asc" }],
  });
}

export async function getWarehouseOperationsDashboard(options?: { includeWarehouses?: boolean }) {
  const { companyId } = await requireCompanyAuth();
  await ensureDefaultBranchAndWarehouse(prisma, companyId);
  const includeWarehouses = options?.includeWarehouses ?? true;

  const [warehouses, productsForReplenishment, purchaseOrders, draftSales, adjustmentLogs] =
    await Promise.all([
      includeWarehouses
        ? prisma.warehouse.findMany({
            where: { companyId, deletedAt: null },
            select: {
              id: true,
              name: true,
              code: true,
              isActive: true,
              branch: { select: { id: true, name: true, code: true } },
              productStocks: { select: { quantity: true } },
              locations: {
                where: { deletedAt: null },
                select: { id: true, type: true, barcode: true },
              },
            },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
      prisma.product.findMany({
        where: { companyId, deletedAt: null, isActive: true },
        select: { stock: true, minStock: true, barcode: true },
      }),
      prisma.purchase.count({
        where: {
          companyId,
          deletedAt: null,
          status: { in: ["DRAFT", "PENDING", "PARTIALLY_RECEIVED"] },
        },
      }),
      prisma.sale.count({
        where: { companyId, deletedAt: null, status: { in: ["DRAFT", "CONFIRMED"] } },
      }),
      prisma.inventoryLog.count({
        where: { companyId, type: "ADJUSTMENT" },
      }),
    ]);

  const [warehouseCount, locationStats, stockTotal] = includeWarehouses
    ? [warehouses.length, null, null]
    : await Promise.all([
        prisma.warehouse.count({ where: { companyId, deletedAt: null } }),
        prisma.warehouseLocation.groupBy({
          by: ["type"],
          where: { companyId, deletedAt: null },
          _count: { _all: true, barcode: true },
        }),
        prisma.productStock.aggregate({
          where: { companyId },
          _sum: { quantity: true },
        }),
      ]);

  const totalWarehouseStock = includeWarehouses
    ? warehouses.reduce(
        (sum, warehouse) =>
          sum + warehouse.productStocks.reduce((inner, row) => inner + row.quantity, 0),
        0,
      )
    : (stockTotal?._sum.quantity ?? 0);
  const lowStockProducts = productsForReplenishment.filter(
    (product) => product.stock <= product.minStock,
  ).length;
  const locations = includeWarehouses ? warehouses.flatMap((warehouse) => warehouse.locations) : [];
  const locationTypeCounts = includeWarehouses
    ? locations.reduce<Record<string, number>>((counts, location) => {
        counts[location.type] = (counts[location.type] || 0) + 1;
        return counts;
      }, {})
    : Object.fromEntries((locationStats || []).map((row) => [row.type, row._count._all]));
  const locationsWithBarcode = includeWarehouses
    ? locations.filter((location) => Boolean(location.barcode)).length
    : (locationStats || []).reduce((sum, row) => sum + row._count.barcode, 0);
  const locationCount = includeWarehouses
    ? locations.length
    : (locationStats || []).reduce((sum, row) => sum + row._count._all, 0);
  const productsWithBarcode = productsForReplenishment.filter((product) =>
    Boolean(product.barcode),
  ).length;

  return {
    warehouses,
    operationCards: [
      {
        label: "Receipts",
        value: purchaseOrders,
        hint: "Purchases waiting to receive",
        tone: "blue",
      },
      {
        label: "Delivery Orders",
        value: draftSales,
        hint: "Sales not fully delivered",
        tone: "emerald",
      },
      {
        label: "Internal Transfers",
        value: 0,
        hint: "Move stock between warehouses",
        tone: "violet",
      },
      {
        label: "Replenishment",
        value: lowStockProducts,
        hint: "Products at or below minimum",
        tone: "amber",
      },
      {
        label: "Adjustments",
        value: adjustmentLogs,
        hint: "Inventory corrections logged",
        tone: "rose",
      },
      { label: "Batch Transfers", value: 0, hint: "Grouped scan operations", tone: "slate" },
    ],
    totals: {
      warehouses: warehouseCount,
      locations: locationCount,
      stock: totalWarehouseStock,
      lowStockProducts,
    },
    locationTypeCounts,
    barcodeReadiness: {
      productsWithBarcode,
      productsWithoutBarcode: productsForReplenishment.length - productsWithBarcode,
      locationsWithBarcode,
      locationsWithoutBarcode: locationCount - locationsWithBarcode,
    },
  };
}

export async function getWarehouseStock(params?: { warehouseId?: string; search?: string }) {
  const { companyId } = await requireCompanyAuth();
  await ensureDefaultBranchAndWarehouse(prisma, companyId);

  const products = await prisma.product.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(params?.search
        ? {
            OR: [
              { name: { contains: params.search.toLowerCase(), mode: "insensitive" } },
              { sku: { contains: params.search.toLowerCase(), mode: "insensitive" } },
              { barcode: { contains: params.search.toLowerCase(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      stockLocations: {
        where: params?.warehouseId ? { warehouseId: params.warehouseId } : {},
        include: { warehouse: { include: { branch: true } } },
      },
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  return products.map((product) => ({
    ...product,
    totalLocationStock: product.stockLocations.reduce((sum, row) => sum + row.quantity, 0),
  }));
}
