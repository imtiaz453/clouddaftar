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

// ============ NEW STOCK LOCATION HELPERS ============

export async function getUserAccessibleLocationIds(
  prismaClient: typeof prisma,
  companyId: string,
  userId: string,
  role: string,
): Promise<string[]> {
  if (role === "OWNER" || role === "ADMIN") {
    const locations = await prismaClient.stockLocation.findMany({
      where: { companyId, deletedAt: null },
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
      where: {
        companyId,
        branchId: membership.branchId,
        deletedAt: null,
      },
      select: { id: true },
    });

    branchLocations.forEach((location) => ids.add(location.id));
  }

  const assignedLocations = await prismaClient.stockLocation.findMany({
    where: {
      companyId,
      assignedEmployeeId: userId,
      deletedAt: null,
    },
    select: { id: true },
  });

  assignedLocations.forEach((location) => ids.add(location.id));

  return Array.from(ids);
}

// ============ BACKWARD-COMPATIBLE WRAPPERS ============
// These exist so other modules such as purchases and sales can keep working.
// They wrap the new stock location / stock balance system.

export async function ensureDefaultBranchAndWarehouse(tx: Tx, companyId: string) {
  let branch = await tx.branch.findFirst({
    where: { companyId, deletedAt: null, isDefault: true },
  });

  if (!branch) {
    branch = await tx.branch.findFirst({
      where: { companyId, deletedAt: null },
    });
  }

  if (!branch) {
    try {
      branch = await tx.branch.create({
        data: {
          companyId,
          name: "Main Branch",
          code: "MAIN",
          isDefault: true,
        },
      });
    } catch {
      branch = await tx.branch.findFirst({
        where: { companyId, deletedAt: null },
      });
    }
  }

  if (!branch) {
    throw new Error("Could not resolve or create default branch");
  }

  return { branch, warehouse: null };
}

export async function ensureDefaultWarehouseLocations(
  tx: Tx,
  companyId: string,
  warehouse: { id: string; code: string },
) {
  // No-op: new architecture uses StockLocation.
  void tx;
  void companyId;
  void warehouse;
}

export async function resolveOperationalLocation(
  tx: Tx,
  params: {
    companyId: string;
    userId?: string;
    branchId?: string | null;
    warehouseId?: string | null;
  },
) {
  const fallback = await ensureDefaultBranchAndWarehouse(tx, params.companyId);
  const branchId = params.branchId || fallback.branch.id;

  return { branchId, warehouseId: null };
}

async function findDefaultStockLocation(tx: Tx, companyId: string) {
  const mainWarehouseLocation = await tx.stockLocation.findFirst({
    where: {
      companyId,
      type: "MAIN_WAREHOUSE",
      deletedAt: null,
      isActive: true,
    },
    orderBy: { isDefault: "desc" },
  });

  if (mainWarehouseLocation) return mainWarehouseLocation;

  return tx.stockLocation.findFirst({
    where: {
      companyId,
      deletedAt: null,
      isActive: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function getProductStockAtWarehouse(
  tx: Tx,
  product: { id: string; stock: number | null },
  companyId: string,
  warehouseId: string | null,
): Promise<number> {
  void warehouseId;

  const defaultLocation = await findDefaultStockLocation(tx, companyId);

  if (!defaultLocation) {
    return Number(product.stock || 0);
  }

  const balance = await tx.stockBalance.findUnique({
    where: {
      productId_locationId_companyId: {
        productId: product.id,
        locationId: defaultLocation.id,
        companyId,
      },
    },
  });

  return balance ? Number(balance.qtyOnHand) : 0;
}

export async function adjustWarehouseStock(
  tx: Tx,
  params: {
    companyId: string;
    productId: string;
    warehouseId: string | null;
    quantityDelta: number;
  },
) {
  const defaultLocation = await findDefaultStockLocation(tx, params.companyId);

  let beforeStock = 0;

  if (defaultLocation) {
    const balance = await tx.stockBalance.findUnique({
      where: {
        productId_locationId_companyId: {
          productId: params.productId,
          locationId: defaultLocation.id,
          companyId: params.companyId,
        },
      },
    });

    beforeStock = balance ? Number(balance.qtyOnHand) : 0;
  }

  const afterStock = beforeStock + params.quantityDelta;

  // Keep ProductStock updated for backward compatibility because some older
  // purchase/sales screens may still read it.
  if (params.warehouseId) {
    await tx.productStock.upsert({
      where: {
        productId_warehouseId: {
          productId: params.productId,
          warehouseId: params.warehouseId,
        },
      },
      create: {
        companyId: params.companyId,
        productId: params.productId,
        warehouseId: params.warehouseId,
        quantity: afterStock,
      },
      update: {
        quantity: afterStock,
      },
    });
  }

  return { beforeStock, afterStock };
}
