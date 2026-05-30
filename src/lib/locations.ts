import { prisma } from "@/lib/prisma";

type Tx = typeof prisma | any;

export const DEFAULT_WAREHOUSE_LOCATIONS = [
  { name: "Stock", codeSuffix: "STOCK", type: "INTERNAL", isReplenishable: true },
  { name: "Input", codeSuffix: "IN", type: "INPUT", isReplenishable: false },
  { name: "Quality", codeSuffix: "QC", type: "QUALITY", isReplenishable: false },
  { name: "Packing", codeSuffix: "PACK", type: "PACKING", isReplenishable: false },
  { name: "Output", codeSuffix: "OUT", type: "OUTPUT", isReplenishable: false },
  { name: "Transit", codeSuffix: "TRANSIT", type: "TRANSIT", isReplenishable: false },
  {
    name: "Inventory Loss",
    codeSuffix: "LOSS",
    type: "INVENTORY_LOSS",
    isReplenishable: false,
    isScrapLocation: true,
  },
] as const;

export async function getUserAccessibleLocationIds(
  prismaClient: typeof prisma,
  companyId: string,
  userId: string,
  role: string,
): Promise<string[]> {
  if (role === "OWNER" || role === "ADMIN") {
    const locations = await prismaClient.stockLocation.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    return locations.map((location) => location.id);
  }

  const ids = new Set<string>();

  const membership = await prismaClient.companyMembership.findFirst({
    where: { companyId, userId, isActive: true },
    select: { branchId: true },
  });

  if (membership?.branchId) {
    const branchLocations = await prismaClient.stockLocation.findMany({
      where: { companyId, branchId: membership.branchId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    branchLocations.forEach((location) => ids.add(location.id));
  }

  const assignedLocations = await prismaClient.stockLocation.findMany({
    where: { companyId, assignedEmployeeId: userId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  assignedLocations.forEach((location) => ids.add(location.id));

  return Array.from(ids);
}

export async function ensureDefaultBranchAndWarehouse(tx: Tx, companyId: string) {
  let branch = await tx.branch.findFirst({
    where: { companyId, deletedAt: null, isDefault: true },
  });

  if (!branch) {
    branch = await tx.branch.findFirst({ where: { companyId, deletedAt: null } });
  }

  if (!branch) {
    try {
      branch = await tx.branch.create({
        data: { companyId, name: "Main Branch", code: "MAIN", isDefault: true },
      });
    } catch {
      branch = await tx.branch.findFirst({ where: { companyId, deletedAt: null } });
    }
  }

  if (!branch) throw new Error("Could not resolve or create default branch");

  return { branch, warehouse: null };
}

export async function ensureDefaultWarehouseLocations(
  tx: Tx,
  companyId: string,
  warehouse: { id: string; code: string },
) {
  void tx;
  void companyId;
  void warehouse;
}

export async function resolveOperationalLocation(
  tx: Tx,
  params: { companyId: string; userId?: string; branchId?: string | null; warehouseId?: string | null },
) {
  const fallback = await ensureDefaultBranchAndWarehouse(tx, params.companyId);
  const branchId = params.branchId || fallback.branch.id;
  return { branchId, warehouseId: params.warehouseId || null };
}

async function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function getOrCreateDefaultStockLocation(tx: Tx, companyId: string) {
  const existing = await tx.stockLocation.findFirst({
    where: {
      companyId,
      deletedAt: null,
      isActive: true,
      OR: [{ isDefault: true }, { type: "MAIN_WAREHOUSE" }],
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (existing) return existing;

  const anyLocation = await tx.stockLocation.findFirst({
    where: { companyId, deletedAt: null, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (anyLocation) return anyLocation;

  const code = await normalizeCode(`MAIN-STOCK-${companyId.slice(-6)}`);
  try {
    return await tx.stockLocation.create({
      data: {
        companyId,
        name: "Main Stock",
        code,
        type: "MAIN_WAREHOUSE",
        isDefault: true,
        isActive: true,
        isSellable: true,
      },
    });
  } catch {
    return tx.stockLocation.findFirst({
      where: { companyId, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }
}

async function resolveStockLocation(tx: Tx, companyId: string, warehouseId: string | null) {
  if (warehouseId) {
    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, companyId, deletedAt: null },
      select: { code: true, name: true },
    });

    if (warehouse) {
      const byCode = await tx.stockLocation.findFirst({
        where: { companyId, code: warehouse.code, deletedAt: null, isActive: true },
      });
      if (byCode) return byCode;

      const code = await normalizeCode(warehouse.code || warehouse.name || `WH-${warehouseId.slice(-6)}`);
      try {
        return await tx.stockLocation.create({
          data: {
            companyId,
            name: warehouse.name || "Warehouse Stock",
            code,
            type: "MAIN_WAREHOUSE",
            isDefault: false,
            isActive: true,
            isSellable: true,
          },
        });
      } catch {
        const createdByAnotherRequest = await tx.stockLocation.findFirst({
          where: { companyId, code, deletedAt: null },
        });
        if (createdByAnotherRequest) return createdByAnotherRequest;
      }
    }
  }

  return getOrCreateDefaultStockLocation(tx, companyId);
}

export async function getProductStockAtWarehouse(
  tx: Tx,
  product: { id: string; stock: number | null },
  companyId: string,
  warehouseId: string | null,
): Promise<number> {
  const stockLocation = await resolveStockLocation(tx, companyId, warehouseId);
  if (!stockLocation) return Number(product.stock || 0);

  const balance = await tx.stockBalance.findUnique({
    where: {
      productId_locationId_companyId: {
        productId: product.id,
        locationId: stockLocation.id,
        companyId,
      },
    },
  });

  return balance ? Number(balance.qtyAvailable) : 0;
}

export async function adjustWarehouseStock(
  tx: Tx,
  params: { companyId: string; productId: string; warehouseId: string | null; quantityDelta: number },
) {
  const stockLocation = await resolveStockLocation(tx, params.companyId, params.warehouseId);
  if (!stockLocation) throw new Error("Could not resolve stock location");

  const balance = await tx.stockBalance.upsert({
    where: {
      productId_locationId_companyId: {
        productId: params.productId,
        locationId: stockLocation.id,
        companyId: params.companyId,
      },
    },
    update: {},
    create: {
      companyId: params.companyId,
      productId: params.productId,
      locationId: stockLocation.id,
      qtyOnHand: 0,
      qtyReserved: 0,
      qtyAvailable: 0,
      reorderPoint: 0,
      averageCost: 0,
    },
  });

  const beforeStock = Number(balance.qtyOnHand);
  const beforeReserved = Number(balance.qtyReserved);
  const afterStock = beforeStock + Number(params.quantityDelta);
  if (afterStock < 0) throw new Error("Insufficient stock");

  const afterAvailable = Math.max(0, afterStock - beforeReserved);

  await tx.stockBalance.update({
    where: { id: balance.id },
    data: {
      qtyOnHand: afterStock,
      qtyAvailable: afterAvailable,
      lastMovementAt: new Date(),
    },
  });

  await tx.product.update({
    where: { id: params.productId },
    data: { stock: Math.round(afterStock) },
  });

  if (params.warehouseId) {
    await tx.productStock.upsert({
      where: { productId_warehouseId: { productId: params.productId, warehouseId: params.warehouseId } },
      create: {
        companyId: params.companyId,
        productId: params.productId,
        warehouseId: params.warehouseId,
        quantity: Math.round(afterStock),
      },
      update: { quantity: Math.round(afterStock) },
    });
  }

  return { beforeStock, afterStock, locationId: stockLocation.id };
}
