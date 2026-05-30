"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { serialize } from "@/lib/serialize";
import { getUserAccessibleLocationIds } from "@/lib/locations";
import { generateSku } from "@/lib/utils";
import * as InventoryService from "@/services/inventory";

// ============ PRODUCTS ============

export async function getProducts(params?: {
  search?: string; categoryId?: string; page?: number; pageSize?: number;
  isActive?: boolean; stockStatus?: "all" | "low" | "out"; locationId?: string;
  trackingMode?: string;
}) {
  const { companyId, id: userId, role } = await requireCompanyAuth();

  if (params?.locationId) {
    const accessibleIds = await getUserAccessibleLocationIds(prisma, companyId, userId, role);
    if (!accessibleIds.includes(params.locationId)) throw new Error("Access denied: you do not have access to this stock location");
  }

  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const where: Record<string, unknown> = { companyId, deletedAt: null };

  if (params?.isActive !== undefined) where.isActive = params.isActive;
  if (params?.categoryId) where.categoryId = params.categoryId;
  if (params?.trackingMode) where.trackingMode = params.trackingMode;
  if (params?.search) {
    const q = params.search.toLowerCase();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
    ];
  }
  if (params?.locationId) {
    where.stockBalances = { some: { locationId: params.locationId } };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: where as any,
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.product.count({ where: where as any }),
  ]);

  const productIds = products.map((p) => p.id);
  const allBalances = productIds.length > 0
    ? await prisma.stockBalance.findMany({
        where: { productId: { in: productIds }, companyId },
        select: { productId: true, locationId: true, qtyOnHand: true, qtyReserved: true, qtyAvailable: true, averageCost: true, location: { select: { id: true, name: true, code: true, type: true } } },
      })
    : [];

  type ProductStockSummary = {
    totalOnHand: number;
    totalReserved: number;
    totalAvailable: number;
    stockValue: number;
    locations: Array<{
      id: string;
      name: string;
      code: string | null;
      type: string | null;
      qtyOnHand: number;
      qtyReserved: number;
      qtyAvailable: number;
    }>;
    allLocationTotals: {
      totalOnHand: number;
      totalReserved: number;
      totalAvailable: number;
      stockValue: number;
    };
    isLocationFiltered: boolean;
  };

  const emptyStock = (): ProductStockSummary => ({
    totalOnHand: 0,
    totalReserved: 0,
    totalAvailable: 0,
    stockValue: 0,
    locations: [],
    allLocationTotals: { totalOnHand: 0, totalReserved: 0, totalAvailable: 0, stockValue: 0 },
    isLocationFiltered: Boolean(params?.locationId),
  });

  const balancesByProduct = new Map<string, ProductStockSummary>();
  for (const b of allBalances) {
    const key = b.productId;
    const existing = balancesByProduct.get(key) || emptyStock();
    const qoh = Number(b.qtyOnHand);
    const reserved = Number(b.qtyReserved);
    const available = Number(b.qtyAvailable);
    const value = qoh * Number(b.averageCost);

    existing.allLocationTotals.totalOnHand += qoh;
    existing.allLocationTotals.totalReserved += reserved;
    existing.allLocationTotals.totalAvailable += available;
    existing.allLocationTotals.stockValue += value;

    const shouldCountInVisibleStock = !params?.locationId || b.locationId === params.locationId;
    if (shouldCountInVisibleStock) {
      existing.totalOnHand += qoh;
      existing.totalReserved += reserved;
      existing.totalAvailable += available;
      existing.stockValue += value;
      existing.locations.push({
        id: b.location.id,
        name: b.location.name,
        code: b.location.code,
        type: b.location.type,
        qtyOnHand: qoh,
        qtyReserved: reserved,
        qtyAvailable: available,
      });
    }

    balancesByProduct.set(key, existing);
  }

  const enhancedProducts = products.map((product) => {
    const stock = balancesByProduct.get(product.id) || emptyStock();
    stock.locations.sort((a, b) => b.qtyOnHand - a.qtyOnHand || a.name.localeCompare(b.name));
    return { ...product, stockSummary: stock };
  });

  const filtered = params?.stockStatus
    ? enhancedProducts.filter((p) => {
        if (params.stockStatus === "low") return p.stockSummary.totalOnHand > 0 && p.stockSummary.totalOnHand <= p.minStock;
        if (params.stockStatus === "out") return p.stockSummary.totalOnHand === 0 && !p.isService;
        return true;
      })
    : enhancedProducts;

  return serialize({
    data: filtered,
    total: params?.stockStatus ? filtered.length : total,
    page, pageSize,
    totalPages: Math.ceil((params?.stockStatus ? filtered.length : total) / pageSize),
  });
}

export async function getProductDetail(id: string) {
  const { companyId } = await requireCompanyAuth();

  const product = await prisma.product.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { category: true },
  });
  if (!product) return null;

  const [stockBalances, recentLedger, recentSales, recentPurchases, lots] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { productId: id, companyId },
      include: { location: { select: { id: true, name: true, code: true, type: true } } },
      orderBy: { qtyOnHand: "desc" },
    }),
    prisma.stockLedger.findMany({
      where: { productId: id, companyId },
      include: { location: { select: { name: true } }, createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    }),
    prisma.saleItem.findMany({
      where: { productId: id, sale: { companyId, deletedAt: null } },
      include: { sale: { select: { id: true, invoiceNumber: true, createdAt: true, status: true, total: true, customer: { select: { name: true } } } } },
      orderBy: { sale: { createdAt: "desc" } }, take: 20,
    }),
    prisma.purchaseItem.findMany({
      where: { productId: id, purchase: { companyId, deletedAt: null } },
      include: { purchase: { select: { id: true, referenceNumber: true, createdAt: true, status: true, total: true, supplier: { select: { name: true } } } } },
      orderBy: { purchase: { createdAt: "desc" } }, take: 20,
    }),
    prisma.productLot.findMany({
      where: { productId: id, companyId, isActive: true },
      include: { stocks: { include: { location: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return serialize({ product, stockBalances, ledger: recentLedger, sales: recentSales, purchases: recentPurchases, lots });
}

export async function createProduct(data: {
  name: string; sku?: string; barcode?: string; description?: string;
  purchasePrice: number; sellingPrice: number; wholesalePrice?: number;
  minStock: number; maxStock?: number; unit?: string; tax?: number;
  categoryId?: string | null; isService?: boolean; trackingMode?: string; image?: string;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();

  const settings = await prisma.companySettings.findUnique({ where: { companyId } });
  const sku = data.sku || generateSku(settings?.skuPrefix || "CD");

  const product = await prisma.product.create({
    data: {
      name: data.name, sku, barcode: data.barcode || "", description: data.description,
      purchasePrice: data.purchasePrice, sellingPrice: data.sellingPrice,
      wholesalePrice: data.wholesalePrice, stock: 0, minStock: data.minStock,
      maxStock: data.maxStock, unit: data.unit || "pcs", tax: data.tax ?? 0,
      categoryId: data.categoryId || null, isService: data.isService ?? false,
      trackingMode: (data.trackingMode as any) || "NONE", image: data.image, companyId,
    },
  });

  revalidatePath("/inventory/products");
  return serialize(product);
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  const { companyId } = await requireCompanyAuth();

  const existing = await prisma.product.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!existing) throw new Error("Product not found");

  // Never update stock directly via product edit
  const { stock, mfgDate, expiryDate, ...safeData } = data as any;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...safeData,
      image: safeData.image ? String(safeData.image) : null,
    },
  });

  revalidatePath("/inventory/products");
  return serialize(product);
}

export async function deleteProduct(id: string) {
  const { companyId } = await requireCompanyAuth();
  const existing = await prisma.product.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!existing) throw new Error("Product not found");
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/inventory/products");
}

export async function getProductsForSelector(search?: string) {
  const { companyId } = await requireCompanyAuth();
  const where: Record<string, unknown> = { companyId, deletedAt: null, isActive: true, isService: false };
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
    orderBy: { name: "asc" }, take: 50,
  });
  return products;
}

// ============ LOCATIONS ============

export async function getInventoryLocations(params?: { type?: string; search?: string; isActive?: boolean }) {
  const { companyId, id: userId, role } = await requireCompanyAuth();
  const accessibleIds = await getUserAccessibleLocationIds(prisma, companyId, userId, role);
  const locations = await InventoryService.getInventoryLocations(companyId, accessibleIds);

  let filtered = locations;
  if (params?.type) filtered = filtered.filter((l) => l.type === params.type);
  if (params?.isActive !== undefined) filtered = filtered.filter((l) => l.isActive === params.isActive);
  if (params?.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
  }

  const enriched = await Promise.all(
    filtered.map(async (loc) => {
      const aggregates = await prisma.stockBalance.aggregate({
        where: { locationId: loc.id, companyId },
        _sum: { qtyOnHand: true },
      });
      const totalQty = Number(aggregates._sum.qtyOnHand || 0);
      const productCount = await prisma.stockBalance.count({ where: { locationId: loc.id, companyId, qtyOnHand: { gt: 0 } } });
      return { ...loc, totalProducts: productCount, totalQty };
    }),
  );

  return serialize(enriched);
}

export async function getInventoryLocationDetail(locationId: string) {
  const { companyId, id: userId, role } = await requireCompanyAuth();
  const accessibleIds = await getUserAccessibleLocationIds(prisma, companyId, userId, role);
  if (!accessibleIds.includes(locationId)) throw new Error("Access denied");
  return serialize(await InventoryService.getInventoryLocationDetail(locationId, companyId));
}

export async function createInventoryLocation(data: {
  name: string; code: string; type: string; branchId?: string | null;
  assignedEmployeeId?: string | null; isDefault?: boolean; isSellable?: boolean;
  address?: string | null; notes?: string | null;
}) {
  const { companyId } = await requireCompanyAuth();
  const result = await InventoryService.createInventoryLocation({ ...data, companyId });
  revalidatePath("/inventory/locations");
  return serialize(result);
}

export async function updateInventoryLocation(id: string, data: {
  name?: string; code?: string; type?: string; branchId?: string | null;
  assignedEmployeeId?: string | null; isDefault?: boolean; isSellable?: boolean;
  address?: string | null; notes?: string | null; isActive?: boolean;
}) {
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

export async function getLocationsForSelect(params?: { type?: string; sellableOnly?: boolean }) {
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

export async function getBranchesForSelect() {
  const { companyId } = await requireCompanyAuth();
  return prisma.branch.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

export async function getEmployeesForSelect() {
  const { companyId } = await requireCompanyAuth();
  return prisma.employeeRecord.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

// ============ DASHBOARD ============

export async function getInventoryDashboardData() {
  const { companyId } = await requireCompanyAuth();
  return serialize(await InventoryService.getInventoryDashboard(companyId));
}

// ============ LEDGER ============

export async function getStockLedgerData(params: {
  productId?: string; locationId?: string; movementType?: string;
  dateFrom?: string; dateTo?: string; reference?: string; page?: number; pageSize?: number;
}) {
  const { companyId } = await requireCompanyAuth();
  return serialize(await InventoryService.getStockLedger({
    companyId, ...params,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
  }));
}

export async function getStockMovementTypes() {
  const { companyId } = await requireCompanyAuth();
  return InventoryService.getStockMovementTypes(companyId);
}

export async function getMovementTypeLabels() {
  return InventoryService.getMovementTypeLabels();
}

// ============ ADJUSTMENTS ============

export async function getStockAdjustments(params?: { page?: number; pageSize?: number }) {
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
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.stockAdjustment.count({ where: { companyId } }),
  ]);

  return serialize({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function getStockAdjustmentDetail(id: string) {
  const { companyId } = await requireCompanyAuth();
  const adjustment = await prisma.stockAdjustment.findUnique({
    where: { id, companyId },
    include: {
      location: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
  });
  if (!adjustment) throw new Error("Adjustment not found");
  return serialize(adjustment);
}

export async function createStockAdjustmentAction(data: {
  locationId: string; reason: string; notes?: string | null;
  items: Array<{ productId: string; direction: "IN" | "OUT"; quantity: number; unitCost?: number }>;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();
  const result = await InventoryService.createStockAdjustment({
    ...data, reason: data.reason as any, companyId, createdById: userId,
  });
  revalidatePath("/inventory/adjustments");
  return serialize(result);
}

export async function postStockAdjustmentAction(adjustmentId: string) {
  const { companyId, id: userId } = await requireCompanyAuth();
  await InventoryService.postStockAdjustment(adjustmentId, companyId, userId);
  revalidatePath("/inventory/adjustments");
}

// ============ TRANSFERS ============

export async function getStockTransfers(params?: { status?: string; page?: number; pageSize?: number }) {
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
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.stockTransfer.count({ where: where as any }),
  ]);

  return serialize({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function getStockTransferDetail(id: string) {
  const { companyId } = await requireCompanyAuth();
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id, companyId },
    include: {
      sourceLocation: true, destinationLocation: true,
      createdBy: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
  });
  if (!transfer) throw new Error("Transfer not found");
  return serialize(transfer);
}

export async function createStockTransferAction(data: {
  sourceLocationId: string; destinationLocationId: string; notes?: string | null;
  items: Array<{ productId: string; quantity: number }>;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();
  const result = await InventoryService.createStockTransfer({ ...data, companyId, createdById: userId });
  revalidatePath("/inventory/transfers");
  return serialize(result);
}

export async function issueStockTransferAction(transferId: string) {
  const { companyId, id: userId } = await requireCompanyAuth();
  await InventoryService.issueStockTransfer(transferId, companyId, userId);
  revalidatePath("/inventory/transfers");
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

// ============ STOCK COUNTS ============

export async function getStockCounts(params?: { status?: string; page?: number; pageSize?: number }) {
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
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.stockCount.count({ where: where as any }),
  ]);

  return serialize({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function getStockCountDetail(id: string) {
  const { companyId } = await requireCompanyAuth();
  const count = await prisma.stockCount.findUnique({
    where: { id, companyId },
    include: {
      location: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
  });
  if (!count) throw new Error("Stock count not found");
  return serialize(count);
}

export async function createStockCountAction(data: { locationId: string; notes?: string | null }) {
  const { companyId, id: userId } = await requireCompanyAuth();
  const result = await InventoryService.createStockCount({ ...data, companyId, createdById: userId });
  revalidatePath("/inventory/stock-counts");
  return serialize(result);
}

export async function updateStockCountItemAction(countId: string, itemId: string, countedQty: number) {
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

// ============ LOTS / EXPIRY ============

export async function getProductLots(params?: { productId?: string; locationId?: string; expiringSoon?: boolean; active?: boolean; page?: number; pageSize?: number }) {
  const { companyId } = await requireCompanyAuth();
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 30;
  const where: Record<string, unknown> = { companyId };
  if (params?.productId) where.productId = params.productId;
  if (params?.active !== undefined) where.isActive = params.active;
  if (params?.expiringSoon) {
    where.expiryDate = { not: null, lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) };
  }

  const [data, total] = await Promise.all([
    prisma.productLot.findMany({
      where: where as any,
      include: {
        product: { select: { id: true, name: true, sku: true, trackingMode: true } },
        stocks: { include: { location: { select: { id: true, name: true } } } },
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.productLot.count({ where: where as any }),
  ]);

  return serialize({
    data: data.map((lot) => ({
      id: lot.id, lotNumber: lot.lotNumber, serialNumber: lot.serialNumber,
      mfgDate: lot.mfgDate, expiryDate: lot.expiryDate, notes: lot.notes, isActive: lot.isActive,
      productId: lot.productId, productName: lot.product.name, productSku: lot.product.sku, trackingMode: lot.product.trackingMode,
      totalQty: lot.stocks.reduce((s, st) => s + st.quantity, 0),
      locations: lot.stocks.map((st) => ({ id: st.location.id, name: st.location.name, quantity: st.quantity })),
      daysToExpire: lot.expiryDate ? Math.ceil((lot.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
      createdAt: lot.createdAt,
    })),
    total, page, pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function createProductLot(data: {
  productId: string; locationId: string; lotNumber: string; serialNumber?: string;
  quantity: number; mfgDate?: string; expiryDate?: string; notes?: string;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();

  const product = await prisma.product.findFirst({
    where: { id: data.productId, companyId, deletedAt: null, isService: false },
    select: { id: true, name: true, trackingMode: true },
  });
  if (!product) throw new Error("Product not found");

  const location = await prisma.stockLocation.findFirst({
    where: { id: data.locationId, companyId, deletedAt: null, isActive: true },
  });
  if (!location) throw new Error("Location not found");

  const isSerial = Boolean(data.serialNumber?.trim()) || product.trackingMode === "SERIAL";
  if (isSerial && data.quantity !== 1) {
    throw new Error("Serial-number tracked items must be registered one unit at a time");
  }

  const result = await prisma.$transaction(async (tx) => {
    const lot = await tx.productLot.upsert({
      where: { productId_lotNumber_companyId: { productId: product.id, lotNumber: data.lotNumber.trim(), companyId } },
      create: {
        productId: product.id, companyId, lotNumber: data.lotNumber.trim(),
        serialNumber: data.serialNumber?.trim() || null,
        mfgDate: data.mfgDate ? new Date(data.mfgDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        notes: data.notes,
      },
      update: {
        serialNumber: data.serialNumber?.trim() || null,
        mfgDate: data.mfgDate ? new Date(data.mfgDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        notes: data.notes, isActive: true,
      },
    });

    const currentLotStock = await tx.productLotStock.findUnique({
      where: { lotId_locationId: { lotId: lot.id, locationId: data.locationId } },
      select: { quantity: true },
    });
    const beforeLotStock = currentLotStock?.quantity || 0;
    const afterLotStock = beforeLotStock + data.quantity;

    await tx.productLotStock.upsert({
      where: { lotId_locationId: { lotId: lot.id, locationId: data.locationId } },
      create: { lotId: lot.id, productId: product.id, locationId: data.locationId, companyId, quantity: afterLotStock },
      update: { quantity: afterLotStock },
    });

    // Auto-update tracking mode if needed
    const nextTrackingMode = isSerial ? "SERIAL" : "LOT";
    if (product.trackingMode === "NONE") {
      await tx.product.update({
        where: { id: product.id },
        data: { trackingMode: nextTrackingMode },
      });
    }

    return lot;
  });

  revalidatePath("/inventory/lots");
  return serialize(result);
}

export async function getExpiringLots() {
  const { companyId } = await requireCompanyAuth();
  const lots = await prisma.productLot.findMany({
    where: {
      companyId, isActive: true, expiryDate: { not: null, lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      stocks: { include: { location: { select: { id: true, name: true } } } },
    },
    orderBy: { expiryDate: "asc" }, take: 30,
  });

  return serialize(lots.map((lot) => ({
    id: lot.id, lotNumber: lot.lotNumber, expiryDate: lot.expiryDate,
    productId: lot.productId, productName: lot.product.name, productSku: lot.product.sku,
    totalQty: lot.stocks.reduce((s, st) => s + st.quantity, 0),
    locations: lot.stocks.map((st) => ({ id: st.location.id, name: st.location.name, quantity: st.quantity })),
    daysToExpire: lot.expiryDate ? Math.ceil((lot.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
  })));
}

// ============ CATEGORIES ============

export async function getCategories() {
  const { companyId } = await requireCompanyAuth();
  return serialize(await prisma.category.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
  }));
}

export async function createCategory(data: { name: string; description?: string; color?: string }) {
  const { companyId } = await requireCompanyAuth();
  const result = await prisma.category.create({
    data: { name: data.name, description: data.description, color: data.color, companyId },
  });
  revalidatePath("/inventory/products");
  return serialize(result);
}

// ============ REPLENISHMENT / LOW STOCK ============

export async function getReplenishmentData() {
  const { companyId } = await requireCompanyAuth();

  const balances = await prisma.stockBalance.findMany({
    where: { companyId },
    include: {
      product: { select: { id: true, name: true, sku: true, minStock: true, maxStock: true, purchasePrice: true, unit: true, companyId: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { location: { name: "asc" } }],
  });

  const lowStock = balances
    .filter((b) => {
      const available = Number(b.qtyAvailable);
      const minStock = Number(b.product.minStock);
      const reorderPoint = Number(b.reorderPoint);
      const threshold = reorderPoint > 0 ? reorderPoint : minStock;
      return threshold > 0 && available <= threshold;
    })
    .map((b) => ({
      productId: b.productId, productName: b.product.name, sku: b.product.sku,
      locationId: b.locationId, locationName: b.location.name,
      availableQty: Number(b.qtyAvailable), minStock: Number(b.product.minStock),
      reorderPoint: Number(b.reorderPoint),
      shortfall: Math.max((Number(b.reorderPoint) || Number(b.product.minStock)) - Number(b.qtyAvailable), 0),
      suggestedOrderQty: Number(b.product.maxStock)
        ? Math.max(Number(b.product.maxStock) - Number(b.qtyAvailable), 0)
        : Math.max((Number(b.product.minStock) * 2) - Number(b.qtyAvailable), 0),
      unit: b.product.unit, lastPurchasePrice: Number(b.product.purchasePrice),
    }))
    .sort((a, b) => b.shortfall - a.shortfall);

  return serialize(lowStock);
}

// ============ LOW STOCK (backward compat) ============

export async function getLowStockProducts() {
  const result = await getProducts({ stockStatus: "low", pageSize: 9999 });
  const data = (result as any).data || [];
  return data.map((p: any) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.stockSummary?.totalOnHand || 0,
    minStock: p.minStock || 0,
    unit: p.unit,
    purchasePrice: Number(p.purchasePrice),
    sellingPrice: Number(p.sellingPrice),
    category: p.category || null,
  }));
}

// ============ STOCK BALANCE HELPERS ============

export async function getProductStockByLocationsAction(productId: string) {
  const { companyId } = await requireCompanyAuth();
  return serialize(await InventoryService.getProductStockByLocation(productId, companyId));
}

export async function getProductStockSummaryAction(productId: string) {
  const { companyId } = await requireCompanyAuth();
  return serialize(await InventoryService.getProductStockSummary(productId, companyId));
}

export async function createOpeningBalanceAction(data: {
  locationId: string; productId: string; quantity: number; unitCost?: number;
}) {
  const { companyId, id: userId } = await requireCompanyAuth();
  await InventoryService.createOpeningBalance({ ...data, companyId, createdById: userId });
  revalidatePath("/inventory/products");
}
