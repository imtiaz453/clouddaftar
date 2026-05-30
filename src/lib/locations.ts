import { prisma } from "@/lib/prisma";
import * as InventoryService from "@/services/inventory";

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

// ============ BACKWARD-COMPATIBLE WRAPPERS ============
// These exist so other modules (purchases, sales) can keep working.
// They wrap the new stock location / stock balance system.

export async function ensureDefaultBranchAndWarehouse(tx: Tx, companyId: string) {
  let branch = await tx.branch.findFirst({
    where: { companyId, deletedAt: null, isDefault: true },
  });
  if (!branch) branch = await tx.branch.findFirst({ where: { companyId, deletedAt: null } });
  if (!branch) {
    try {
      branch = await tx.branch.create({
        data: { companyId, name: "Main Branch", code: "MAIN", isDefault: true },
      });
    } catch { /* ignore duplicate */ }
  }
  return { branch, warehouse: null };
}

export async function ensureDefaultWarehouseLocations(tx: Tx, companyId: string, warehouse: { id: string; code: string }) {
  // No-op: new architecture uses StockLocation
}

export async function resolveOperationalLocation(
  tx: Tx,
  params: { companyId: string; userId?: string; branchId?: string | null; warehouseId?: string | null },
) {
  const fallback = await ensureDefaultBranchAndWarehouse(tx, params.companyId);
  let branchId = params.branchId || fallback.branch.id;
  return { branchId, warehouseId: null };
}

export async function getProductStockAtWarehouse(
  tx: Tx,
  product: { id: string; stock: number | null },
  companyId: string,
  warehouseId: string | null,
): Promise<number> {
  // Find default location and use StockBalance
  const defaultLocation = await tx.stockLocation.findFirst({
    where: { companyId, type: "MAIN_WAREHOUSE", deletedAt: null, isActive: true },
    orderBy: { isDefault: "desc" },
  });
  if (!defaultLocation) return Number(product.stock || 0);
  const balance = await tx.stockBalance.findUnique({
    where: { productId_locationId: { productId: product.id, locationId: defaultLocation.id } },
  });
  return balance ? Number(balance.qtyOnHand) : 0;
}

export async function adjustWarehouseStock(
  tx: Tx,
  params: { companyId: string; productId: string; warehouseId: string | null; quantityDelta: number },
) {
  // Map warehouse to default stock location
  const defaultLocation = await tx.stockLocation.findFirst({
    where: { companyId: params.companyId, type: "MAIN_WAREHOUSE", deletedAt: null, isActive: true },
    orderBy: { isDefault: "desc" },
  });
  const locationId = defaultLocation?.id || "unknown";

  const balance = await tx.stockBalance.findUnique({
    where: { productId_locationId: { productId: params.productId, locationId } },
  });
  const beforeStock = balance ? Number(balance.qtyOnHand) : 0;
  const afterStock = beforeStock + params.quantityDelta;

  // Just update ProductStock for backward compat (other modules may read it)
  if (params.warehouseId) {
    await tx.productStock.upsert({
      where: { productId_warehouseId: { productId: params.productId, warehouseId: params.warehouseId } },
      create: { companyId: params.companyId, productId: params.productId, warehouseId: params.warehouseId, quantity: afterStock },
      update: { quantity: afterStock },
    });
  }

  return { beforeStock, afterStock };
}
