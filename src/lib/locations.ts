import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Tx = typeof prisma | any;

export const DEFAULT_WAREHOUSE_LOCATIONS = [
  { name: "Stock", codeSuffix: "STOCK", type: "INTERNAL", isReplenishable: true },
  { name: "Input", codeSuffix: "IN", type: "INPUT", isReplenishable: false },
  { name: "Quality", codeSuffix: "QC", type: "QUALITY", isReplenishable: false },
  { name: "Packing", codeSuffix: "PACK", type: "PACKING", isReplenishable: false },
  { name: "Output", codeSuffix: "OUT", type: "OUTPUT", isReplenishable: false },
  { name: "Transit", codeSuffix: "TRANSIT", type: "TRANSIT", isReplenishable: false },
  { name: "Inventory Loss", codeSuffix: "LOSS", type: "INVENTORY_LOSS", isReplenishable: false, isScrapLocation: true },
] as const;

export async function ensureDefaultWarehouseLocations(tx: Tx, companyId: string, warehouse: { id: string; code: string }) {
  const existingCount = await tx.warehouseLocation.count({
    where: { companyId, warehouseId: warehouse.id, deletedAt: null },
  });
  if (existingCount > 0) return;

  for (const location of DEFAULT_WAREHOUSE_LOCATIONS) {
    await tx.warehouseLocation.create({
      data: {
        companyId,
        warehouseId: warehouse.id,
        name: location.name,
        code: `${warehouse.code}-${location.codeSuffix}`.slice(0, 32),
        type: location.type,
        isReplenishable: location.isReplenishable,
        isScrapLocation: "isScrapLocation" in location ? location.isScrapLocation : false,
      },
    });
  }
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
        data: {
          companyId,
          name: "Main Branch",
          code: "MAIN",
          isDefault: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        branch = await tx.branch.findUnique({
          where: { code_companyId: { code: "MAIN", companyId } },
        });
        if (!branch) throw error;
        if (branch.deletedAt || !branch.isActive) {
          branch = await tx.branch.update({
            where: { id: branch.id },
            data: { deletedAt: null, isActive: true, isDefault: true },
          });
        }
      } else {
        throw error;
      }
    }
  }

  let warehouse = await tx.warehouse.findFirst({
    where: { companyId, deletedAt: null, branchId: branch.id, isDefault: true },
  });

  if (!warehouse) {
    warehouse = await tx.warehouse.findFirst({
      where: { companyId, deletedAt: null, branchId: branch.id },
    });
  }

  if (!warehouse) {
    try {
      warehouse = await tx.warehouse.create({
        data: {
          companyId,
          branchId: branch.id,
          name: "Main Warehouse",
          code: "MAIN",
          isDefault: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        warehouse = await tx.warehouse.findUnique({
          where: { code_companyId: { code: "MAIN", companyId } },
        });
        if (!warehouse) throw error;
        if (warehouse.deletedAt || !warehouse.isActive || warehouse.branchId !== branch.id) {
          warehouse = await tx.warehouse.update({
            where: { id: warehouse.id },
            data: {
              branchId: branch.id,
              deletedAt: null,
              isActive: true,
              isDefault: true,
            },
          });
        }
      } else {
        throw error;
      }
    }
  }

  await ensureDefaultWarehouseLocations(tx, companyId, warehouse);

  return { branch, warehouse };
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
  let branchId = params.branchId || null;
  let warehouseId = params.warehouseId || null;

  if (!branchId && params.userId) {
    const membership = await tx.companyMembership.findFirst({
      where: { companyId: params.companyId, userId: params.userId, isActive: true },
      select: { branchId: true },
    });
    branchId = membership?.branchId || null;
  }

  if (branchId) {
    const branch = await tx.branch.findFirst({
      where: { id: branchId, companyId: params.companyId, deletedAt: null, isActive: true },
    });
    if (!branch) throw new Error("Branch not found");
  } else {
    branchId = fallback.branch.id;
  }

  if (warehouseId) {
    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, companyId: params.companyId, deletedAt: null, isActive: true },
    });
    if (!warehouse) throw new Error("Warehouse not found");
    if (warehouse.branchId && warehouse.branchId !== branchId) {
      throw new Error("Warehouse does not belong to the selected branch");
    }
  } else {
    const branchWarehouse = await tx.warehouse.findFirst({
      where: { companyId: params.companyId, branchId, deletedAt: null, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    warehouseId = branchWarehouse?.id || fallback.warehouse.id;
  }

  if (!branchId || !warehouseId) {
    throw new Error("Could not resolve branch and warehouse");
  }

  return { branchId, warehouseId };
}

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
    return locations.map((l) => l.id);
  }

  const ids = new Set<string>();
  const membership = await prismaClient.companyMembership.findFirst({
    where: { companyId, userId, isActive: true },
    select: { branchId: true },
  });

  if (membership?.branchId) {
    const branchLocations = await prismaClient.stockLocation.findMany({
      where: { companyId, branchId: membership.branchId, deletedAt: null },
      select: { id: true },
    });
    branchLocations.forEach((l) => ids.add(l.id));
  }

  const assigned = await prismaClient.stockLocation.findMany({
    where: { companyId, assignedEmployeeId: userId, deletedAt: null },
    select: { id: true },
  });
  assigned.forEach((l) => ids.add(l.id));

  return Array.from(ids);
}

export async function getProductStockAtWarehouse(
  tx: Tx,
  product: { id: string; stock: number | null },
  companyId: string,
  warehouseId: string,
) {
  const stock = await tx.productStock.findUnique({
    where: { productId_warehouseId: { productId: product.id, warehouseId } },
  });

  if (stock) return stock.quantity;

  const anyLocationStock = await tx.productStock.count({
    where: { productId: product.id, companyId },
  });

  return anyLocationStock === 0 ? Number(product.stock || 0) : 0;
}

export async function adjustWarehouseStock(
  tx: Tx,
  params: {
    companyId: string;
    productId: string;
    warehouseId: string;
    quantityDelta: number;
  },
) {
  const existing = await tx.productStock.findUnique({
    where: {
      productId_warehouseId: {
        productId: params.productId,
        warehouseId: params.warehouseId,
      },
    },
  });
  let beforeStock = existing?.quantity ?? 0;
  if (!existing) {
    const existingLocationCount = await tx.productStock.count({
      where: { productId: params.productId, companyId: params.companyId },
    });
    if (existingLocationCount === 0) {
      const product = await tx.product.findFirst({
        where: { id: params.productId, companyId: params.companyId },
        select: { stock: true },
      });
      beforeStock = Number(product?.stock || 0);
    }
  }
  const afterStock = beforeStock + params.quantityDelta;

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
    update: { quantity: afterStock },
  });

  await tx.product.update({
    where: { id: params.productId },
    data: { stock: { increment: params.quantityDelta } },
  });

  return { beforeStock, afterStock };
}
