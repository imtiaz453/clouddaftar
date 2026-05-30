"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { getUserAccessibleLocationIds } from "@/lib/locations";
import { serialize } from "@/lib/serialize";
import { Prisma } from "@prisma/client";
import * as InventoryService from "@/services/inventory";

// ============ INVENTORY LOCATIONS ============

export async function getInventoryLocations(params?: {
  type?: string;
  search?: string;
  isActive?: boolean;
}) {
  const { companyId, id: userId, role } = await requireCompanyAuth();
  const accessibleIds = await getUserAccessibleLocationIds(prisma, companyId, userId, role);

  const where: Record<string, unknown> = {
    id: { in: accessibleIds },
    companyId,
    deletedAt: null,
  };
  if (params?.type) where.type = params.type;
  if (params?.isActive !== undefined) where.isActive = params.isActive;
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { code: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const locations = await prisma.stockLocation.findMany({
    where: where as any,
    include: {
      branch: { select: { id: true, name: true } },
      assignedEmployee: { select: { id: true, name: true } },
      _count: { select: { stockBalances: true } },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const enriched = await Promise.all(
    locations.map(async (loc) => {
      const aggregates = await prisma.stockBalance.aggregate({
        where: { locationId: loc.id, companyId },
        _sum: { qtyOnHand: true },
      });
      const totalQty = Number(aggregates._sum.qtyOnHand || 0);
      return { ...loc, totalProducts: loc._count.stockBalances, totalQty };
    }),
  );

  return serialize(enriched);
}

export async function getInventoryLocationDetail(locationId: string) {
  const { companyId, id: userId, role } = await requireCompanyAuth();
  const accessibleIds = await getUserAccessibleLocationIds(prisma, companyId, userId, role);
  if (!accessibleIds.includes(locationId)) throw new Error("Access denied");

  const location = await prisma.stockLocation.findUnique({
    where: { id: locationId, companyId },
    include: {
      branch: { select: { id: true, name: true } },
      assignedEmployee: { select: { id: true, name: true, email: true } },
    },
  });
  if (!location) throw new Error("Location not found");

  const balances = await prisma.stockBalance.findMany({
    where: { locationId, companyId },
    include: { product: { select: { id: true, name: true, sku: true, barcode: true, sellingPrice: true, purchasePrice: true, unit: true, category: { select: { name: true } } } } },
    orderBy: { product: { name: "asc" } },
  });

  const recentLedger = await prisma.stockLedger.findMany({
    where: { locationId, companyId },
    include: { product: { select: { name: true } }, createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return serialize({
    location,
    balances: balances.map((b) => ({
      id: b.id,
      productId: b.productId,
      productName: b.product.name,
      sku: b.product.sku,
      barcode: b.product.barcode,
      unit: b.product.unit,
      categoryName: b.product.category?.name ?? null,
      qtyOnHand: Number(b.qtyOnHand),
      qtyReserved: Number(b.qtyReserved),
      qtyAvailable: Number(b.qtyAvailable),
      averageCost: Number(b.averageCost),
      stockValue: Number(b.qtyOnHand) * Number(b.averageCost),
    })),
    recentLedger: recentLedger.map((l) => ({
      id: l.id,
      movementType: l.movementType,
      quantity: Number(l.quantity),
      qtyOnHandBefore: Number(l.qtyOnHandBefore),
      qtyOnHandAfter: Number(l.qtyOnHandAfter),
      productName: l.product.name,
      createdByName: l.createdBy?.name ?? "System",
      createdAt: l.createdAt,
    })),
  });
}

export async function createInventoryLocation(data: {
  name: string;
  code: string;
  type: string;
  branchId?: string | null;
  assignedEmployeeId?: string | null;
  isDefault?: boolean;
  isSellable?: boolean;
  address?: string | null;
  notes?: string | null;
}) {
  const { companyId } = await requireCompanyAuth();
  const result = await InventoryService.createInventoryLocation({ ...data, companyId });
  revalidatePath("/inventory/locations");
  return serialize(result);
}

export async function updateInventoryLocation(
  id: string,
  data: {
    name?: string;
    code?: string;
    type?: string;
    branchId?: string | null;
    assignedEmployeeId?: string | null;
    isDefault?: boolean;
    isSellable?: boolean;
    address?: string | null;
    notes?: string | null;
    isActive?: boolean;
  },
) {
  const { companyId } = await requireCompanyAuth();
  const result = await InventoryService.updateInventoryLocation(id, data, companyId);
  revalidatePath("/inventory/locations");
  return serialize(result);
}

export async function deleteInventoryLocation(id: string) {
  const { companyId } = await requireCompanyAuth();
  await prisma.stockLocation.update({
    where: { id, companyId },
    data: { deletedAt: new Date(), isActive: false },
  });
  revalidatePath("/inventory/locations");
}

// ============ STOCK TRANSFERS ============

export async function getStockTransfers(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { companyId } = await requireCompanyAuth();
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const where: Record<string, unknown> = { companyId };
  if (params?.status) where.status = params.status;

  const [data, total] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: where as any,
      include: {
        sourceLocation: { select: { id: true, name: true, code: true } },
        destinationLocation: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockTransfer.count({ where: where as any }),
  ]);

  return serialize({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function getStockTransferDetail(id: string) {
  const { companyId } = await requireCompanyAuth();
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id, companyId },
    include: {
      sourceLocation: true,
      destinationLocation: true,
      createdBy: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
  });
  if (!transfer) throw new Error("Transfer not found");
  return serialize(transfer);
}

export async function createStockTransferAction(data: {
  sourceLocationId: string;
  destinationLocationId: string;
  notes?: string | null;
  items: Array<{ productId: string; quantity: number }>;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();
  const result = await InventoryService.createStockTransfer({
    ...data,
    companyId,
    createdById: userId,
  });
  revalidatePath("/inventory/transfers");
  return serialize(result);
}

export async function receiveStockTransferAction(transferId: string) {
  const { companyId, id: userId } = await requireCompanyAuth();
  await InventoryService.receiveStockTransfer(transferId, companyId, userId);
  revalidatePath("/inventory/transfers");
}

export async function cancelStockTransferAction(transferId: string) {
  const { companyId, id: userId } = await requireCompanyAuth();
  await InventoryService.cancelStockTransfer(transferId, companyId, userId, true);
  revalidatePath("/inventory/transfers");
}

// ============ STOCK ADJUSTMENTS ============

export async function getStockAdjustments(params?: {
  page?: number;
  pageSize?: number;
}) {
  const { companyId } = await requireCompanyAuth();
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const [data, total] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where: { companyId },
      include: {
        location: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockAdjustment.count({ where: { companyId } }),
  ]);

  return serialize({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function createStockAdjustmentAction(data: {
  locationId: string;
  reason: string;
  notes?: string | null;
  items: Array<{ productId: string; direction: "IN" | "OUT"; quantity: number; unitCost?: number }>;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();
  const result = await InventoryService.createStockAdjustment({
    ...data,
    reason: data.reason as any,
    companyId,
    createdById: userId,
  });
  revalidatePath("/inventory/adjustments");
  return serialize(result);
}

// ============ STOCK COUNTS ============

export async function getStockCounts(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { companyId } = await requireCompanyAuth();
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const where: Record<string, unknown> = { companyId };
  if (params?.status) where.status = params.status;

  const [data, total] = await Promise.all([
    prisma.stockCount.findMany({
      where: where as any,
      include: {
        location: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockCount.count({ where: where as any }),
  ]);

  return serialize({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function createStockCountAction(data: {
  locationId: string;
  notes?: string | null;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();
  const result = await InventoryService.createStockCount({
    ...data,
    companyId,
    createdById: userId,
  });
  revalidatePath("/inventory/stock-counts");
  return serialize(result);
}

export async function updateStockCountItemAction(
  countId: string,
  itemId: string,
  countedQty: number,
) {
  const { companyId } = await requireCompanyAuth();
  return serialize(await InventoryService.updateStockCountItem(countId, itemId, countedQty, companyId));
}

export async function reviewStockCountAction(countId: string) {
  const { companyId, id: userId } = await requireCompanyAuth();
  const result = await InventoryService.reviewStockCount(countId, companyId, userId);
  revalidatePath("/inventory/stock-counts");
  return serialize(result);
}

export async function postStockCountAction(countId: string) {
  const { companyId, id: userId } = await requireCompanyAuth();
  await InventoryService.postStockCount(countId, companyId, userId);
  revalidatePath("/inventory/stock-counts");
}

// ============ STOCK LEDGER ============

export async function getStockLedgerData(params: {
  productId?: string;
  locationId?: string;
  movementType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const { companyId } = await requireCompanyAuth();
  return serialize(await InventoryService.getStockLedger({
    companyId,
    productId: params.productId,
    locationId: params.locationId,
    movementType: params.movementType,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
    page: params.page,
    pageSize: params.pageSize,
  }));
}

// ============ INVENTORY DASHBOARD ============

export async function getInventoryDashboardData() {
  const { companyId } = await requireCompanyAuth();
  return serialize(await InventoryService.getInventoryDashboard(companyId));
}

// ============ PRODUCT STOCK ============

export async function getProductStockByLocationsAction(productId: string) {
  const { companyId } = await requireCompanyAuth();
  return serialize(await InventoryService.getProductStockByLocation(productId, companyId));
}

// ============ LOCATIONS FOR SELECTS ============

export async function getLocationsForSelect(params?: {
  type?: string;
  sellableOnly?: boolean;
}) {
  const { companyId } = await requireCompanyAuth();
  const where: Record<string, unknown> = { companyId, deletedAt: null, isActive: true };
  if (params?.type) where.type = params.type;
  if (params?.sellableOnly) where.isSellable = true;

  const locations = await prisma.stockLocation.findMany({
    where: where as any,
    select: { id: true, name: true, code: true, type: true },
    orderBy: { name: "asc" },
  });
  return locations;
}

export async function getEmployeesForSelect() {
  const { companyId } = await requireCompanyAuth();
  const employees = await prisma.employeeRecord.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return employees;
}

export async function getBranchesForSelect() {
  const { companyId } = await requireCompanyAuth();
  const branches = await prisma.branch.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  return branches;
}

// ============ PRODUCTS FOR SELECT (lightweight) ============

export async function getProductsForSelector(search?: string) {
  const { companyId } = await requireCompanyAuth();
  const where: Record<string, unknown> = {
    companyId,
    deletedAt: null,
    isActive: true,
    isService: false,
  };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }
  const products = await prisma.product.findMany({
    where: where as any,
    select: { id: true, name: true, sku: true, barcode: true, unit: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  return products;
}
