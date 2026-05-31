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

function mapWarehouseTypeToStockLocationType(type?: string | null) {
  if (type === "POS_STORE") return "POS_STORE";
  if (type === "EMPLOYEE_STORE") return "EMPLOYEE_STORE";
  return "MAIN_WAREHOUSE";
}

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

  if (params.warehouseId) {
    const selectedWarehouse = await tx.warehouse.findFirst({
      where: {
        id: params.warehouseId,
        companyId: params.companyId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, branchId: true },
    });

    if (!selectedWarehouse) {
      throw new Error("Selected receiving store/warehouse was not found or is inactive");
    }

    return {
      branchId: params.branchId || selectedWarehouse.branchId || fallback.branch.id,
      warehouseId: selectedWarehouse.id,
    };
  }

  const defaultReceivingWarehouse = await tx.warehouse.findFirst({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      isDefault: true,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, branchId: true },
  });

  const firstActiveWarehouse = defaultReceivingWarehouse
    ? null
    : await tx.warehouse.findFirst({
        where: {
          companyId: params.companyId,
          deletedAt: null,
          isActive: true,
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true, branchId: true },
      });

  const receivingWarehouse = defaultReceivingWarehouse || firstActiveWarehouse;
  const branchId = params.branchId || receivingWarehouse?.branchId || fallback.branch.id;

  return {
    branchId,
    warehouseId: receivingWarehouse?.id || null,
  };
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
      select: { code: true, name: true, type: true, branchId: true, assignedEmployeeId: true, isDefault: true, isActive: true },
    });

    if (warehouse) {
      const byCode = await tx.stockLocation.findFirst({
        where: { companyId, code: warehouse.code, deletedAt: null, isActive: true },
      });
      if (byCode) {
        const nextType = mapWarehouseTypeToStockLocationType(warehouse.type);
        const needsSync =
          byCode.name !== warehouse.name ||
          byCode.type !== nextType ||
          byCode.branchId !== (warehouse.branchId || null) ||
          byCode.assignedEmployeeId !== (warehouse.assignedEmployeeId || null) ||
          byCode.isDefault !== Boolean(warehouse.isDefault) ||
          byCode.isActive !== Boolean(warehouse.isActive);

        if (needsSync) {
          return tx.stockLocation.update({
            where: { id: byCode.id },
            data: {
              name: warehouse.name || byCode.name,
              type: nextType,
              branchId: warehouse.branchId || null,
              assignedEmployeeId: warehouse.assignedEmployeeId || null,
              isDefault: Boolean(warehouse.isDefault),
              isActive: Boolean(warehouse.isActive),
              isSellable: true,
            },
          });
        }
        return byCode;
      }

      const code = await normalizeCode(warehouse.code || warehouse.name || `WH-${warehouseId.slice(-6)}`);
      try {
        return await tx.stockLocation.create({
          data: {
            companyId,
            name: warehouse.name || "Warehouse Stock",
            code,
            type: mapWarehouseTypeToStockLocationType(warehouse.type),
            branchId: warehouse.branchId || null,
            assignedEmployeeId: warehouse.assignedEmployeeId || null,
            isDefault: Boolean(warehouse.isDefault),
            isActive: Boolean(warehouse.isActive),
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



async function findWarehouseByStockLocationCode(
  tx: Tx,
  params: { companyId: string; code?: string | null },
) {
  if (!params.code) return null;
  return tx.warehouse.findFirst({
    where: {
      companyId: params.companyId,
      code: params.code,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true, branchId: true },
  });
}

async function resolveUserBranchId(
  tx: Tx,
  params: { companyId: string; userId?: string | null; branchId?: string | null },
): Promise<string | null> {
  if (params.branchId) return params.branchId;
  if (!params.userId) return null;

  const membership = await tx.companyMembership.findFirst({
    where: { companyId: params.companyId, userId: params.userId, isActive: true },
    select: { branchId: true },
  });

  return membership?.branchId || null;
}

async function findBranchSellableLocation(
  tx: Tx,
  params: { companyId: string; branchId: string; userId?: string | null },
) {
  if (params.userId) {
    const assignedLocation = await tx.stockLocation.findFirst({
      where: {
        companyId: params.companyId,
        branchId: params.branchId,
        assignedEmployeeId: params.userId,
        deletedAt: null,
        isActive: true,
        isSellable: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    if (assignedLocation) return assignedLocation;

    const assignedWarehouse = await tx.warehouse.findFirst({
      where: {
        companyId: params.companyId,
        branchId: params.branchId,
        assignedEmployeeId: params.userId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (assignedWarehouse) {
      return resolveStockLocation(tx, params.companyId, assignedWarehouse.id);
    }
  }

  const branchLocation = await tx.stockLocation.findFirst({
    where: {
      companyId: params.companyId,
      branchId: params.branchId,
      deletedAt: null,
      isActive: true,
      isSellable: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (branchLocation) return branchLocation;

  const branchWarehouse = await tx.warehouse.findFirst({
    where: {
      companyId: params.companyId,
      branchId: params.branchId,
      deletedAt: null,
      isActive: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (branchWarehouse) return resolveStockLocation(tx, params.companyId, branchWarehouse.id);

  return null;
}

export async function resolveSaleFulfillmentLocation(
  tx: Tx,
  params: {
    companyId: string;
    userId?: string | null;
    role?: string | null;
    branchId?: string | null;
    warehouseId?: string | null;
    stockLocationId?: string | null;
  },
): Promise<{ branchId: string; warehouseId: string | null; stockLocationId: string; stockLocationName: string }> {
  const fallback = await ensureDefaultBranchAndWarehouse(tx, params.companyId);
  const preferredBranchId = await resolveUserBranchId(tx, {
    companyId: params.companyId,
    userId: params.userId,
    branchId: params.branchId,
  });

  if (params.stockLocationId) {
    const selectedLocation = await tx.stockLocation.findFirst({
      where: {
        id: params.stockLocationId,
        companyId: params.companyId,
        deletedAt: null,
        isActive: true,
        isSellable: true,
      },
      select: { id: true, name: true, code: true, branchId: true },
    });

    if (!selectedLocation) {
      throw new Error("Selected stock store/location was not found, inactive, or not sellable");
    }

    const warehouse = await findWarehouseByStockLocationCode(tx, {
      companyId: params.companyId,
      code: selectedLocation.code,
    });

    return {
      branchId: selectedLocation.branchId || preferredBranchId || warehouse?.branchId || fallback.branch.id,
      warehouseId: warehouse?.id || params.warehouseId || null,
      stockLocationId: selectedLocation.id,
      stockLocationName: selectedLocation.name,
    };
  }

  if (params.warehouseId) {
    const selectedWarehouse = await tx.warehouse.findFirst({
      where: {
        id: params.warehouseId,
        companyId: params.companyId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, branchId: true },
    });

    if (!selectedWarehouse) {
      throw new Error("Selected sales store/warehouse was not found or is inactive");
    }

    const stockLocation = await resolveStockLocation(tx, params.companyId, selectedWarehouse.id);
    if (!stockLocation) throw new Error("Could not resolve stock location for selected store/warehouse");

    return {
      branchId: params.branchId || selectedWarehouse.branchId || fallback.branch.id,
      warehouseId: selectedWarehouse.id,
      stockLocationId: stockLocation.id,
      stockLocationName: stockLocation.name,
    };
  }

  if (preferredBranchId) {
    const branchLocation = await findBranchSellableLocation(tx, {
      companyId: params.companyId,
      branchId: preferredBranchId,
      userId: params.userId,
    });

    if (branchLocation) {
      const warehouse = await findWarehouseByStockLocationCode(tx, {
        companyId: params.companyId,
        code: branchLocation.code,
      });

      return {
        branchId: branchLocation.branchId || preferredBranchId,
        warehouseId: warehouse?.id || null,
        stockLocationId: branchLocation.id,
        stockLocationName: branchLocation.name,
      };
    }
  }

  const defaultLocation = await getOrCreateDefaultStockLocation(tx, params.companyId);
  if (!defaultLocation) throw new Error("Could not resolve a sales stock location");

  const warehouse = await findWarehouseByStockLocationCode(tx, {
    companyId: params.companyId,
    code: defaultLocation.code,
  });

  return {
    branchId: defaultLocation.branchId || warehouse?.branchId || fallback.branch.id,
    warehouseId: warehouse?.id || null,
    stockLocationId: defaultLocation.id,
    stockLocationName: defaultLocation.name,
  };
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

  const productStockTotal = await tx.stockBalance.aggregate({
    where: {
      companyId: params.companyId,
      productId: params.productId,
    },
    _sum: { qtyOnHand: true },
  });

  await tx.product.update({
    where: { id: params.productId },
    data: { stock: Math.round(Number(productStockTotal._sum.qtyOnHand || 0)) },
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
