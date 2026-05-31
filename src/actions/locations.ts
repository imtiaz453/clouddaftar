"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, requirePermission, revalidateBoth } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";
import { createAuditLog } from "@/lib/audit";
import { ensureDefaultBranchAndWarehouse, ensureDefaultWarehouseLocations } from "@/lib/locations";
import type { StoreType } from "@prisma/client";

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .slice(0, 24);
}

function mapWarehouseTypeToStockLocationType(type: StoreType) {
  if (type === "POS_STORE") return "POS_STORE";
  if (type === "EMPLOYEE_STORE") return "EMPLOYEE_STORE";
  return "MAIN_WAREHOUSE";
}

async function syncWarehouseStockLocation(
  tx: any,
  companyId: string,
  warehouse: {
    id: string;
    name: string;
    code: string;
    type: StoreType;
    branchId?: string | null;
    assignedEmployeeId?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  },
  previousCode?: string | null,
) {
  const code = normalizeCode(warehouse.code || warehouse.name);
  const type = mapWarehouseTypeToStockLocationType(warehouse.type);

  const existing = await tx.stockLocation.findFirst({
    where: {
      companyId,
      deletedAt: null,
      OR: [{ code }, ...(previousCode && previousCode !== code ? [{ code: previousCode }] : [])],
    },
    orderBy: { updatedAt: "desc" },
  });

  const data = {
    name: warehouse.name.trim(),
    code,
    type,
    branchId: warehouse.branchId || null,
    assignedEmployeeId: warehouse.assignedEmployeeId || null,
    isDefault: warehouse.isDefault ?? false,
    isActive: warehouse.isActive ?? true,
    isSellable: true,
  };

  if (existing) {
    return tx.stockLocation.update({ where: { id: existing.id }, data });
  }

  return tx.stockLocation.create({ data: { companyId, ...data } });
}

export async function getBranches() {
  await requirePermission(PERMISSIONS.BRANCHES_VIEW);
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
    include: {
      branch: { select: { id: true, name: true, code: true } },
      assignedEmployee: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getBranchesList() {
  await requirePermission(PERMISSIONS.STORES_VIEW);
  const { companyId } = await requireCompanyAuth();
  return prisma.branch.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

export async function getStores() {
  await requirePermission(PERMISSIONS.STORES_VIEW);
  const { companyId } = await requireCompanyAuth();
  await ensureDefaultBranchAndWarehouse(prisma, companyId);

  return prisma.warehouse.findMany({
    where: { companyId, deletedAt: null },
    include: {
      branch: { select: { id: true, name: true, code: true } },
      assignedEmployee: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getEmployeesList() {
  await requirePermission(PERMISSIONS.STORES_VIEW);
  const { companyId } = await requireCompanyAuth();
  return prisma.user.findMany({
    where: {
      companies: {
        some: { companyId, isActive: true, role: { in: ["STAFF", "MANAGER", "OWNER"] } },
      },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
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
  await requirePermission(PERMISSIONS.BRANCHES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
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
          type: "POS_STORE",
          name: `${created.name} Store`,
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
  revalidateBoth("/settings", user.companySlug);
  return branch;
}

export async function updateBranch(data: {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  isActive?: boolean;
}) {
  await requirePermission(PERMISSIONS.BRANCHES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  if (!data.name.trim()) throw new Error("Branch name is required");

  const branch = await prisma.branch.findFirst({
    where: { id: data.id, companyId, deletedAt: null },
  });
  if (!branch) throw new Error("Branch not found");

  const code = data.code ? normalizeCode(data.code) : branch.code;

  const updated = await prisma.branch.update({
    where: { id: data.id },
    data: {
      name: data.name.trim(),
      code,
      phone: data.phone ?? branch.phone,
      email: data.email ?? branch.email,
      address: data.address ?? branch.address,
      city: data.city ?? branch.city,
      isActive: data.isActive ?? branch.isActive,
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Branch",
    entityId: updated.id,
    metadata: { name: updated.name, code: updated.code },
  });
  revalidateBoth("/settings", user.companySlug);
  return updated;
}

export async function deleteBranch(id: string) {
  await requirePermission(PERMISSIONS.BRANCHES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const branch = await prisma.branch.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!branch) throw new Error("Branch not found");

  if (branch.isDefault) throw new Error("Cannot delete the default branch");

  await prisma.branch.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await createAuditLog({
    userId: user.id,
    companyId,
    action: "DISABLE",
    entity: "Branch",
    entityId: id,
    metadata: { name: branch.name, action: "deleted" },
  });
  revalidateBoth("/settings", user.companySlug);
}

export async function toggleBranchStatus(id: string, isActive: boolean) {
  await requirePermission(PERMISSIONS.BRANCHES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const branch = await prisma.branch.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!branch) throw new Error("Branch not found");

  const updated = await prisma.branch.update({
    where: { id },
    data: { isActive },
  });

  await createAuditLog({
    userId,
    companyId,
    action: isActive ? "ENABLE" : "DISABLE",
    entity: "Branch",
    entityId: updated.id,
    metadata: { name: updated.name },
  });
  revalidateBoth("/settings", user.companySlug);
  return updated;
}

export async function createWarehouse(data: {
  name: string;
  code?: string;
  type?: StoreType;
  branchId?: string;
  assignedEmployeeId?: string;
  isDefault?: boolean;
  notes?: string;
}) {
  await requirePermission(PERMISSIONS.STORES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const code = normalizeCode(data.code || data.name);
  if (!data.name.trim()) throw new Error("Store/Warehouse name is required");
  if (!code) throw new Error("Store/Warehouse code is required");

  const type = data.type || "MAIN_WAREHOUSE";

  if (type === "POS_STORE" && !data.branchId) {
    throw new Error("Branch is required for POS/Showroom stores");
  }
  if (type === "EMPLOYEE_STORE" && !data.assignedEmployeeId) {
    throw new Error("Employee is required for Employee stores");
  }

  if (data.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, companyId, deletedAt: null },
    });
    if (!branch) throw new Error("Branch not found");
  }

  if (data.assignedEmployeeId) {
    const employee = await prisma.user.findFirst({
      where: { id: data.assignedEmployeeId, companies: { some: { companyId } } },
    });
    if (!employee) throw new Error("Employee not found");
  }

  const warehouse = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.warehouse.updateMany({
        where: { companyId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tx.warehouse.create({
      data: {
        companyId,
        type,
        branchId: data.branchId || null,
        assignedEmployeeId: data.assignedEmployeeId || null,
        name: data.name.trim(),
        code,
        isDefault: data.isDefault ?? false,
        notes: data.notes || null,
      },
    });
    await ensureDefaultWarehouseLocations(tx, companyId, created);
    await syncWarehouseStockLocation(tx, companyId, created);
    return created;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Warehouse",
    entityId: warehouse.id,
    metadata: {
      name: warehouse.name,
      code: warehouse.code,
      type: warehouse.type,
      branchId: warehouse.branchId,
    },
  });
  revalidateBoth("/settings", user.companySlug);
  return warehouse;
}

export async function updateWarehouse(data: {
  id: string;
  name: string;
  code?: string;
  type?: StoreType;
  branchId?: string | null;
  assignedEmployeeId?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  notes?: string | null;
}) {
  await requirePermission(PERMISSIONS.STORES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  if (!data.name.trim()) throw new Error("Store name is required");

  const existing = await prisma.warehouse.findFirst({
    where: { id: data.id, companyId, deletedAt: null },
  });
  if (!existing) throw new Error("Store not found");

  const type = data.type || existing.type;
  const branchId = data.branchId !== undefined ? data.branchId || null : existing.branchId;
  const assignedEmployeeId =
    data.assignedEmployeeId !== undefined
      ? data.assignedEmployeeId || null
      : existing.assignedEmployeeId;

  if (type === "POS_STORE" && !branchId) {
    throw new Error("Branch is required for POS/Showroom stores");
  }
  if (type === "EMPLOYEE_STORE" && !assignedEmployeeId) {
    throw new Error("Employee is required for Employee stores");
  }

  const code = data.code ? normalizeCode(data.code) : existing.code;

  const nextIsDefault = data.isDefault ?? existing.isDefault;
  const nextIsActive = data.isActive ?? existing.isActive;

  if (nextIsDefault && !nextIsActive) {
    throw new Error("The purchase receiving warehouse must be active");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (nextIsDefault) {
      await tx.warehouse.updateMany({
        where: { companyId, deletedAt: null, isDefault: true, id: { not: data.id } },
        data: { isDefault: false },
      });
    }

    const updatedWarehouse = await tx.warehouse.update({
      where: { id: data.id },
      data: {
        name: data.name.trim(),
        code,
        type,
        branchId,
        assignedEmployeeId,
        isDefault: nextIsDefault,
        isActive: nextIsActive,
        notes: data.notes !== undefined ? data.notes : existing.notes,
      },
    });

    await syncWarehouseStockLocation(tx, companyId, updatedWarehouse, existing.code);
    return updatedWarehouse;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Warehouse",
    entityId: updated.id,
    metadata: { name: updated.name, code: updated.code, type: updated.type },
  });
  revalidateBoth("/settings", user.companySlug);
  return updated;
}

export async function deleteWarehouse(id: string) {
  await requirePermission(PERMISSIONS.STORES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const warehouse = await prisma.warehouse.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!warehouse) throw new Error("Store not found");

  await prisma.warehouse.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await createAuditLog({
    userId: user.id,
    companyId,
    action: "DISABLE",
    entity: "Warehouse",
    entityId: id,
    metadata: { name: warehouse.name, action: "deleted" },
  });
  revalidateBoth("/settings", user.companySlug);
}

export async function toggleWarehouseStatus(id: string, isActive: boolean) {
  await requirePermission(PERMISSIONS.STORES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const warehouse = await prisma.warehouse.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!warehouse) throw new Error("Store not found");

  if (!isActive && warehouse.isDefault) {
    throw new Error(
      "Cannot disable the purchase receiving warehouse. Select another default receiving store first.",
    );
  }

  const updated = await prisma.warehouse.update({
    where: { id },
    data: { isActive },
  });

  await createAuditLog({
    userId,
    companyId,
    action: isActive ? "ENABLE" : "DISABLE",
    entity: "Warehouse",
    entityId: updated.id,
    metadata: { name: updated.name },
  });
  revalidateBoth("/settings", user.companySlug);
  return updated;
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
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
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
  revalidateBoth("/inventory/warehouses", user.companySlug);
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
      { label: "Internal Transfers", value: 0, hint: "Move stock between stores", tone: "violet" },
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
