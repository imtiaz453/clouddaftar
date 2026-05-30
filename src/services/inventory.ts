import { PrismaClient, StockMovementType, AdjustmentReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function calcAvailable(qtyOnHand: number, qtyReserved: number): number {
  const available = qtyOnHand - qtyReserved;
  return available < 0 ? 0 : available;
}

async function getOrCreateStockBalance(
  tx: Tx,
  productId: string,
  locationId: string,
  companyId: string,
): Promise<{ id: string; qtyOnHand: number; qtyReserved: number; qtyAvailable: number; averageCost: number }> {
  const balance = await tx.stockBalance.upsert({
    where: { productId_locationId_companyId: { productId, locationId, companyId } },
    update: {},
    create: {
      productId,
      locationId,
      companyId,
      qtyOnHand: 0,
      qtyReserved: 0,
      qtyAvailable: 0,
      averageCost: 0,
      reorderPoint: 0,
    },
  });
  return {
    id: balance.id,
    qtyOnHand: Number(balance.qtyOnHand),
    qtyReserved: Number(balance.qtyReserved),
    qtyAvailable: Number(balance.qtyAvailable),
    averageCost: Number(balance.averageCost),
  };
}

async function postStockLedger(
  tx: Tx,
  params: {
    productId: string;
    locationId: string;
    companyId: string;
    movementType: StockMovementType;
    quantity: number;
    qtyOnHandBefore: number;
    qtyOnHandAfter: number;
    qtyReservedBefore: number;
    qtyReservedAfter: number;
    reference?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    createdById?: string | null;
  },
): Promise<void> {
  await tx.stockLedger.create({
    data: {
      productId: params.productId,
      locationId: params.locationId,
      companyId: params.companyId,
      movementType: params.movementType,
      quantity: params.quantity,
      qtyOnHandBefore: params.qtyOnHandBefore,
      qtyOnHandAfter: params.qtyOnHandAfter,
      qtyReservedBefore: params.qtyReservedBefore,
      qtyReservedAfter: params.qtyReservedAfter,
      reference: params.reference ?? null,
      referenceId: params.referenceId ?? null,
      notes: params.notes ?? null,
      createdById: params.createdById ?? null,
    },
  });
}

// ========== ADJUST STOCK BALANCE (core mutation) ==========

export async function adjustStockBalance(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    direction: "IN" | "OUT";
    movementType?: StockMovementType;
    reason?: string | null;
    notes?: string | null;
    createdById?: string | null;
    unitCost?: number;
    allowNegative?: boolean;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await getOrCreateStockBalance(tx, params.productId, params.locationId, params.companyId);
    const movementType: StockMovementType = params.movementType ?? (params.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT");
    const qty = params.direction === "IN" ? params.quantity : -params.quantity;
    const qtyOnHandAfter = before.qtyOnHand + qty;
    if (qtyOnHandAfter < 0 && !params.allowNegative) throw new Error("Insufficient stock");

    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);

    const unitCost = params.unitCost ?? before.averageCost;
    const totalCost = Number(before.averageCost) * Number(before.qtyOnHand);
    const newTotalCost = params.direction === "IN"
      ? totalCost + params.quantity * unitCost
      : totalCost - params.quantity * unitCost;
    const newAvgCost = qtyOnHandAfter > 0 ? newTotalCost / qtyOnHandAfter : 0;

    await tx.stockBalance.update({
      where: { id: before.id },
      data: {
        qtyOnHand: qtyOnHandAfter,
        qtyAvailable: qtyAvailableAfter,
        averageCost: newAvgCost,
        lastMovementAt: new Date(),
      },
    });

    await postStockLedger(tx, {
      productId: params.productId,
      locationId: params.locationId,
      companyId: params.companyId,
      movementType,
      quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand,
      qtyOnHandAfter,
      qtyReservedBefore: before.qtyReserved,
      qtyReservedAfter: before.qtyReserved,
      notes: params.reason
        ? `[${params.reason}]${params.notes ? ` - ${params.notes}` : ""}`
        : params.notes,
      createdById: params.createdById,
    });
  });
}

// ========== READ FUNCTIONS ==========

export async function getStockBalance(
  productId: string,
  locationId: string,
  companyId: string,
): Promise<{ qtyOnHand: number; qtyReserved: number; qtyAvailable: number; averageCost: number } | null> {
  const balance = await prisma.stockBalance.findUnique({
    where: { productId_locationId_companyId: { productId, locationId, companyId } },
  });
  if (!balance) return null;
  return {
    qtyOnHand: Number(balance.qtyOnHand),
    qtyReserved: Number(balance.qtyReserved),
    qtyAvailable: Number(balance.qtyAvailable),
    averageCost: Number(balance.averageCost),
  };
}

export async function getProductStockByLocation(
  productId: string,
  companyId: string,
): Promise<Array<{
  locationId: string;
  locationName: string;
  locationType: string;
  isSellable: boolean;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  averageCost: number;
}>> {
  const balances = await prisma.stockBalance.findMany({
    where: { productId, companyId },
    include: { location: { select: { id: true, name: true, type: true, isSellable: true } } },
  });
  return balances.map((b) => ({
    locationId: b.locationId,
    locationName: b.location.name,
    locationType: b.location.type,
    isSellable: b.location.isSellable,
    qtyOnHand: Number(b.qtyOnHand),
    qtyReserved: Number(b.qtyReserved),
    qtyAvailable: Number(b.qtyAvailable),
    averageCost: Number(b.averageCost),
  }));
}

export async function getProductStockSummary(
  productId: string,
  companyId: string,
): Promise<{ totalOnHand: number; totalReserved: number; totalAvailable: number; totalValue: number }> {
  const balances = await prisma.stockBalance.findMany({
    where: { productId, companyId },
  });
  const totalOnHand = balances.reduce((s, b) => s + Number(b.qtyOnHand), 0);
  const totalReserved = balances.reduce((s, b) => s + Number(b.qtyReserved), 0);
  const totalAvailable = balances.reduce((s, b) => s + Number(b.qtyAvailable), 0);
  const avgCost = balances.length > 0
    ? balances.reduce((s, b) => s + Number(b.averageCost) * Number(b.qtyOnHand), 0) / (totalOnHand || 1)
    : 0;
  return { totalOnHand, totalReserved, totalAvailable, totalValue: totalOnHand * avgCost };
}

export async function getLocationStock(
  locationId: string,
  companyId: string,
  search?: string,
): Promise<Array<{
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  categoryName: string | null;
  unit: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  averageCost: number;
  stockValue: number;
}>> {
  const where: Record<string, unknown> = { locationId, companyId };
  if (search) {
    where.product = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ],
    };
  }
  const balances = await prisma.stockBalance.findMany({
    where: where as any,
    include: {
      product: { select: { id: true, name: true, sku: true, barcode: true, unit: true, category: { select: { name: true } } } },
    },
    orderBy: { product: { name: "asc" } },
  });
  return balances.map((b) => ({
    productId: b.productId,
    productName: b.product.name,
    sku: b.product.sku,
    barcode: b.product.barcode,
    categoryName: b.product.category?.name ?? null,
    unit: b.product.unit,
    qtyOnHand: Number(b.qtyOnHand),
    qtyReserved: Number(b.qtyReserved),
    qtyAvailable: Number(b.qtyAvailable),
    averageCost: Number(b.averageCost),
    stockValue: Number(b.qtyOnHand) * Number(b.averageCost),
  }));
}

export async function validateStockAvailability(
  productId: string,
  locationId: string,
  companyId: string,
  quantity: number,
  allowNegative = false,
): Promise<{ valid: boolean; available: number; onHand: number }> {
  const balance = await prisma.stockBalance.findUnique({
    where: { productId_locationId_companyId: { productId, locationId, companyId } },
  });
  const onHand = balance ? Number(balance.qtyOnHand) : 0;
  const reserved = balance ? Number(balance.qtyReserved) : 0;
  const available = calcAvailable(onHand, reserved);

  if (allowNegative) return { valid: true, available, onHand };
  if (quantity > available) return { valid: false, available, onHand };
  return { valid: true, available, onHand };
}

// ========== STOCK MOVEMENT FUNCTIONS ==========

export async function consumeStockForSaleTx(
  tx: Tx,
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    reference?: string | null;
    referenceId?: string | null;
    createdById?: string | null;
    allowNegative?: boolean;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");
  const before = await getOrCreateStockBalance(tx, params.productId, params.locationId, params.companyId);
  const qtyOnHandAfter = before.qtyOnHand - params.quantity;
  if (qtyOnHandAfter < 0 && !params.allowNegative) throw new Error("Insufficient stock for sale");
  const reserveRelease = Math.min(params.quantity, before.qtyReserved);
  const qtyReservedAfter = before.qtyReserved - reserveRelease;
  const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, qtyReservedAfter);
  await tx.stockBalance.update({
    where: { id: before.id },
    data: { qtyOnHand: qtyOnHandAfter, qtyReserved: qtyReservedAfter, qtyAvailable: qtyAvailableAfter, lastMovementAt: new Date() },
  });
  await postStockLedger(tx, {
    productId: params.productId, locationId: params.locationId, companyId: params.companyId,
    movementType: "SALE", quantity: params.quantity,
    qtyOnHandBefore: before.qtyOnHand, qtyOnHandAfter,
    qtyReservedBefore: before.qtyReserved, qtyReservedAfter,
    reference: params.reference ?? null, referenceId: params.referenceId ?? null,
    createdById: params.createdById,
  });
}

export async function issueSaleFromStock(params: {
  locationId: string; productId: string; companyId: string; quantity: number;
  reference?: string | null; referenceId?: string | null; createdById?: string | null; allowNegative?: boolean;
}): Promise<void> {
  await prisma.$transaction(async (tx) => { await consumeStockForSaleTx(tx, params); });
}

export async function receivePurchaseIntoStock(
  params: {
    locationId: string; productId: string; companyId: string; quantity: number; unitCost?: number;
    reference?: string | null; referenceId?: string | null; notes?: string | null; createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");
  await prisma.$transaction(async (tx) => {
    const before = await getOrCreateStockBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyOnHandAfter = before.qtyOnHand + params.quantity;
    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);
    const unitCost = params.unitCost ?? 0;
    const totalCost = Number(before.averageCost) * Number(before.qtyOnHand);
    const newTotalCost = totalCost + params.quantity * unitCost;
    const newAvgCost = qtyOnHandAfter > 0 ? newTotalCost / qtyOnHandAfter : 0;
    await tx.stockBalance.update({
      where: { id: before.id },
      data: { qtyOnHand: qtyOnHandAfter, qtyAvailable: qtyAvailableAfter, averageCost: newAvgCost, lastMovementAt: new Date() },
    });
    await postStockLedger(tx, {
      productId: params.productId, locationId: params.locationId, companyId: params.companyId,
      movementType: "PURCHASE_RECEIVE", quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand, qtyOnHandAfter,
      qtyReservedBefore: before.qtyReserved, qtyReservedAfter: before.qtyReserved,
      reference: params.reference ?? null, referenceId: params.referenceId ?? null,
      notes: params.notes ?? null, createdById: params.createdById,
    });
  });
}

export async function returnSaleStock(
  params: {
    locationId: string; productId: string; companyId: string; quantity: number; unitCost?: number;
    reference?: string | null; referenceId?: string | null; notes?: string | null; createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");
  await prisma.$transaction(async (tx) => {
    const before = await getOrCreateStockBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyOnHandAfter = before.qtyOnHand + params.quantity;
    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);
    const unitCost = params.unitCost ?? before.averageCost;
    const totalCost = Number(before.averageCost) * Number(before.qtyOnHand);
    const newTotalCost = totalCost + params.quantity * unitCost;
    const newAvgCost = qtyOnHandAfter > 0 ? newTotalCost / qtyOnHandAfter : 0;
    await tx.stockBalance.update({
      where: { id: before.id },
      data: { qtyOnHand: qtyOnHandAfter, qtyAvailable: qtyAvailableAfter, averageCost: newAvgCost, lastMovementAt: new Date() },
    });
    await postStockLedger(tx, {
      productId: params.productId, locationId: params.locationId, companyId: params.companyId,
      movementType: "SALE_RETURN", quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand, qtyOnHandAfter,
      qtyReservedBefore: before.qtyReserved, qtyReservedAfter: before.qtyReserved,
      reference: params.reference ?? null, referenceId: params.referenceId ?? null,
      notes: params.notes ?? null, createdById: params.createdById,
    });
  });
}

export async function returnPurchaseStock(
  params: {
    locationId: string; productId: string; companyId: string; quantity: number;
    reference?: string | null; referenceId?: string | null; notes?: string | null; createdById?: string | null; allowNegative?: boolean;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");
  await prisma.$transaction(async (tx) => {
    const before = await getOrCreateStockBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyOnHandAfter = before.qtyOnHand - params.quantity;
    if (qtyOnHandAfter < 0 && !params.allowNegative) throw new Error("Insufficient stock for purchase return");
    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);
    await tx.stockBalance.update({
      where: { id: before.id },
      data: { qtyOnHand: qtyOnHandAfter, qtyAvailable: qtyAvailableAfter, lastMovementAt: new Date() },
    });
    await postStockLedger(tx, {
      productId: params.productId, locationId: params.locationId, companyId: params.companyId,
      movementType: "PURCHASE_RETURN", quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand, qtyOnHandAfter,
      qtyReservedBefore: before.qtyReserved, qtyReservedAfter: before.qtyReserved,
      reference: params.reference ?? null, referenceId: params.referenceId ?? null,
      notes: params.notes ?? null, createdById: params.createdById,
    });
  });
}

export async function reserveSaleStock(
  params: {
    locationId: string; productId: string; companyId: string; quantity: number;
    reference?: string | null; referenceId?: string | null; createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");
  await prisma.$transaction(async (tx) => {
    const before = await getOrCreateStockBalance(tx, params.productId, params.locationId, params.companyId);
    const available = calcAvailable(before.qtyOnHand, before.qtyReserved);
    if (available < params.quantity) throw new Error("Insufficient available stock for reservation");
    const qtyReservedAfter = before.qtyReserved + params.quantity;
    const qtyAvailableAfter = calcAvailable(before.qtyOnHand, qtyReservedAfter);
    await tx.stockBalance.update({
      where: { id: before.id },
      data: { qtyReserved: qtyReservedAfter, qtyAvailable: qtyAvailableAfter },
    });
    await postStockLedger(tx, {
      productId: params.productId, locationId: params.locationId, companyId: params.companyId,
      movementType: "RESERVATION", quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand, qtyOnHandAfter: before.qtyOnHand,
      qtyReservedBefore: before.qtyReserved, qtyReservedAfter,
      reference: params.reference ?? null, referenceId: params.referenceId ?? null,
      createdById: params.createdById,
    });
  });
}

export async function releaseReservedStock(
  params: {
    locationId: string; productId: string; companyId: string; quantity: number;
    reference?: string | null; referenceId?: string | null; createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");
  await prisma.$transaction(async (tx) => {
    const before = await getOrCreateStockBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyReservedAfter = before.qtyReserved - params.quantity;
    if (qtyReservedAfter < 0) throw new Error("Cannot release more than reserved");
    const qtyAvailableAfter = calcAvailable(before.qtyOnHand, qtyReservedAfter);
    await tx.stockBalance.update({
      where: { id: before.id },
      data: { qtyReserved: qtyReservedAfter, qtyAvailable: qtyAvailableAfter },
    });
    await postStockLedger(tx, {
      productId: params.productId, locationId: params.locationId, companyId: params.companyId,
      movementType: "RESERVATION_RELEASE", quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand, qtyOnHandAfter: before.qtyOnHand,
      qtyReservedBefore: before.qtyReserved, qtyReservedAfter,
      reference: params.reference ?? null, referenceId: params.referenceId ?? null,
      createdById: params.createdById,
    });
  });
}

// ========== OPENING BALANCE ==========

export async function createOpeningBalance(
  params: {
    locationId: string; productId: string; companyId: string; quantity: number; unitCost?: number; createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Opening balance must be positive");
  await prisma.$transaction(async (tx) => {
    const before = await getOrCreateStockBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyOnHandAfter = before.qtyOnHand + params.quantity;
    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);
    const unitCost = params.unitCost ?? 0;
    const totalCost = Number(before.averageCost) * Number(before.qtyOnHand);
    const newTotalCost = totalCost + params.quantity * unitCost;
    const newAvgCost = qtyOnHandAfter > 0 ? newTotalCost / qtyOnHandAfter : 0;
    await tx.stockBalance.update({
      where: { id: before.id },
      data: { qtyOnHand: qtyOnHandAfter, qtyAvailable: qtyAvailableAfter, averageCost: newAvgCost, lastMovementAt: new Date() },
    });
    await postStockLedger(tx, {
      productId: params.productId, locationId: params.locationId, companyId: params.companyId,
      movementType: "OPENING_BALANCE", quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand, qtyOnHandAfter,
      qtyReservedBefore: before.qtyReserved, qtyReservedAfter: before.qtyReserved,
      notes: "Opening balance", createdById: params.createdById,
    });
  });
}

// ========== LOCATION MANAGEMENT ==========

export async function createInventoryLocation(data: {
  name: string; code: string; type: string; branchId?: string | null; assignedEmployeeId?: string | null;
  companyId: string; isDefault?: boolean; isSellable?: boolean; address?: string | null; notes?: string | null;
}) {
  if (data.type === "MAIN_WAREHOUSE" && data.branchId) { data.branchId = null; }
  if ((data.type === "BRANCH_STORE" || data.type === "POS_STORE") && !data.branchId) {
    throw new Error("Branch store or POS store must be linked to a branch");
  }
  if (data.type === "EMPLOYEE_STORE" && !data.assignedEmployeeId) {
    throw new Error("Employee store must be linked to an employee");
  }
  if (data.type === "DAMAGED_STORE" && data.isSellable === undefined) {
    data.isSellable = false;
  }
  const location = await prisma.stockLocation.create({
    data: {
      name: data.name, code: data.code, type: data.type as any,
      branchId: data.branchId ?? null, assignedEmployeeId: data.assignedEmployeeId ?? null,
      companyId: data.companyId, isDefault: data.isDefault ?? false,
      isSellable: data.isSellable ?? true, address: data.address ?? null, notes: data.notes ?? null,
    },
  });
  return location;
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
  companyId: string,
) {
  const existing = await prisma.stockLocation.findFirst({
    where: { id, companyId },
    select: { id: true, type: true, branchId: true, assignedEmployeeId: true },
  });

  if (!existing) throw new Error("Location not found");

  const nextType = data.type ?? existing.type;

  let nextBranchId = data.branchId !== undefined ? data.branchId : existing.branchId;
  let nextAssignedEmployeeId =
    data.assignedEmployeeId !== undefined ? data.assignedEmployeeId : existing.assignedEmployeeId;

  if (nextType === "MAIN_WAREHOUSE") {
    nextBranchId = null;
    nextAssignedEmployeeId = null;
  }

  if (nextType === "BRANCH_STORE" || nextType === "POS_STORE") {
    nextAssignedEmployeeId = null;
    if (!nextBranchId) throw new Error("Branch store or POS store must be linked to a branch");
  }

  if (nextType === "EMPLOYEE_STORE") {
    nextBranchId = null;
    if (!nextAssignedEmployeeId) throw new Error("Employee store must be linked to an employee");
  }

  return prisma.stockLocation.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.type !== undefined && { type: data.type as any }),
      branchId: nextBranchId,
      assignedEmployeeId: nextAssignedEmployeeId,
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.isSellable !== undefined && { isSellable: data.isSellable }),
      ...(data.address !== undefined && { address: data.address ?? null }),
      ...(data.notes !== undefined && { notes: data.notes ?? null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function getInventoryLocations(companyId: string, accessibleIds?: string[]) {
  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (accessibleIds) where.id = { in: accessibleIds };
  return prisma.stockLocation.findMany({
    where: where as any,
    include: { branch: { select: { id: true, name: true } }, assignedEmployee: { select: { id: true, name: true } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function getInventoryLocationDetail(locationId: string, companyId: string) {
  const location = await prisma.stockLocation.findFirst({
    where: { id: locationId, companyId },
    include: { branch: { select: { id: true, name: true } }, assignedEmployee: { select: { id: true, name: true, email: true } } },
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
    orderBy: { createdAt: "desc" }, take: 20,
  });
  return {
    location,
    balances: balances.map((b) => ({
      id: b.id, productId: b.productId, productName: b.product.name, sku: b.product.sku,
      barcode: b.product.barcode, unit: b.product.unit, categoryName: b.product.category?.name ?? null,
      qtyOnHand: Number(b.qtyOnHand), qtyReserved: Number(b.qtyReserved), qtyAvailable: Number(b.qtyAvailable),
      averageCost: Number(b.averageCost), stockValue: Number(b.qtyOnHand) * Number(b.averageCost),
    })),
    recentLedger: recentLedger.map((l) => ({
      id: l.id, movementType: l.movementType, quantity: Number(l.quantity),
      qtyOnHandBefore: Number(l.qtyOnHandBefore), qtyOnHandAfter: Number(l.qtyOnHandAfter),
      productName: l.product.name, createdByName: l.createdBy?.name ?? "System", createdAt: l.createdAt,
    })),
  };
}

// ========== STOCK TRANSFER MANAGEMENT ==========

export async function createStockTransfer(data: {
  sourceLocationId: string; destinationLocationId: string; companyId: string; notes?: string | null;
  createdById: string; items: Array<{ productId: string; quantity: number }>;
}) {
  if (data.sourceLocationId === data.destinationLocationId) throw new Error("Source and destination locations must differ");
  const count = await prisma.stockTransfer.count({ where: { companyId: data.companyId } });
  const refNumber = `TRF-${String(count + 1).padStart(5, "0")}`;
  return prisma.$transaction(async (tx) => {
    for (const item of data.items) {
      const bal = await tx.stockBalance.findUnique({
        where: {
          productId_locationId_companyId: {
            productId: item.productId,
            locationId: data.sourceLocationId,
            companyId: data.companyId,
          },
        },
      });
      const onHand = bal ? Number(bal.qtyOnHand) : 0;
      if (onHand < item.quantity) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true } });
        throw new Error(`Insufficient stock for "${product?.name ?? item.productId}" at source location`);
      }
    }
    return tx.stockTransfer.create({
      data: {
        referenceNumber: refNumber, sourceLocationId: data.sourceLocationId,
        destinationLocationId: data.destinationLocationId, status: "DRAFT",
        companyId: data.companyId, notes: data.notes ?? null, createdById: data.createdById,
        items: { create: data.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) },
      },
      include: { items: { include: { product: { select: { name: true, sku: true } } } } },
    });
  });
}

export async function issueStockTransfer(transferId: string, companyId: string, userId: string) {
  const transfer = await prisma.stockTransfer.findFirst({
    where: { id: transferId, companyId }, include: { items: true },
  });
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "DRAFT") throw new Error(`Cannot issue transfer in status: ${transfer.status}`);

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      const qty = Number(item.quantity);
      const fromBefore = await getOrCreateStockBalance(tx, item.productId, transfer.sourceLocationId, companyId);
      const fromQtyOnHandAfter = fromBefore.qtyOnHand - qty;
      if (fromQtyOnHandAfter < 0) throw new Error("Insufficient stock at source for transfer");
      await tx.stockBalance.update({
        where: { id: fromBefore.id },
        data: { qtyOnHand: fromQtyOnHandAfter, qtyAvailable: calcAvailable(fromQtyOnHandAfter, fromBefore.qtyReserved), lastMovementAt: new Date() },
      });
      await postStockLedger(tx, {
        productId: item.productId, locationId: transfer.sourceLocationId, companyId,
        movementType: "TRANSFER_OUT", quantity: qty,
        qtyOnHandBefore: fromBefore.qtyOnHand, qtyOnHandAfter: fromQtyOnHandAfter,
        qtyReservedBefore: fromBefore.qtyReserved, qtyReservedAfter: fromBefore.qtyReserved,
        reference: transfer.referenceNumber, referenceId: transfer.id,
        notes: `Transfer to ${transfer.destinationLocationId}`, createdById: userId,
      });
    }
    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: "ISSUED", issuedAt: new Date() },
    });
  });
}

export async function receiveStockTransfer(transferId: string, companyId: string, userId: string) {
  const transfer = await prisma.stockTransfer.findFirst({
    where: { id: transferId, companyId },
    include: {
      items: true,
      destinationLocation: {
        select: {
          id: true,
          name: true,
          code: true,
          assignedEmployeeId: true,
          assignedEmployee: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "ISSUED" && transfer.status !== "PARTIALLY_RECEIVED") {
    throw new Error(`Transfer cannot be received in status: ${transfer.status}`);
  }

  const membership = await prisma.companyMembership.findFirst({
    where: { companyId, userId, isActive: true },
    select: { role: true },
  });
  const isOwner = membership?.role === "OWNER";
  const responsibleEmployeeId = transfer.destinationLocation.assignedEmployeeId;

  if (!isOwner) {
    if (!responsibleEmployeeId) {
      throw new Error(
        `Only the company owner can receive this transfer because ${transfer.destinationLocation.name} has no responsible employee assigned. Set a responsible employee in Settings → Stores.`,
      );
    }
    if (responsibleEmployeeId !== userId) {
      const responsibleName = transfer.destinationLocation.assignedEmployee?.name || "the assigned responsible employee";
      throw new Error(
        `Only ${responsibleName} can receive transfers into ${transfer.destinationLocation.name}. Managers and admins cannot receive it unless they are assigned as responsible employee.`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      const qty = Number(item.quantity);
      const toBefore = await getOrCreateStockBalance(tx, item.productId, transfer.destinationLocationId, companyId);
      const toQtyOnHandAfter = toBefore.qtyOnHand + qty;
      await tx.stockBalance.update({
        where: { id: toBefore.id },
        data: { qtyOnHand: toQtyOnHandAfter, qtyAvailable: calcAvailable(toQtyOnHandAfter, toBefore.qtyReserved), lastMovementAt: new Date() },
      });
      await postStockLedger(tx, {
        productId: item.productId, locationId: transfer.destinationLocationId, companyId,
        movementType: "TRANSFER_IN", quantity: qty,
        qtyOnHandBefore: toBefore.qtyOnHand, qtyOnHandAfter: toQtyOnHandAfter,
        qtyReservedBefore: toBefore.qtyReserved, qtyReservedAfter: toBefore.qtyReserved,
        reference: transfer.referenceNumber, referenceId: transfer.id,
        notes: `Transfer from ${transfer.sourceLocationId}`, createdById: userId,
      });
    }
    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
  });
}

export async function cancelStockTransfer(transferId: string, companyId: string, userId: string, allowReverseSource?: boolean) {
  const transfer = await prisma.stockTransfer.findFirst({
    where: { id: transferId, companyId }, include: { items: true },
  });
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status === "RECEIVED" || transfer.status === "CANCELLED") {
    throw new Error("Cannot cancel a received or already cancelled transfer");
  }

  // If issued, reverse source deduction if allowed
  if (transfer.status === "ISSUED" && allowReverseSource) {
    await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        const qty = Number(item.quantity);
        const fromBefore = await getOrCreateStockBalance(tx, item.productId, transfer.sourceLocationId, companyId);
        const fromQtyOnHandAfter = fromBefore.qtyOnHand + qty;
        await tx.stockBalance.update({
          where: { id: fromBefore.id },
          data: { qtyOnHand: fromQtyOnHandAfter, qtyAvailable: calcAvailable(fromQtyOnHandAfter, fromBefore.qtyReserved), lastMovementAt: new Date() },
        });
        await postStockLedger(tx, {
          productId: item.productId, locationId: transfer.sourceLocationId, companyId,
          movementType: "ADJUSTMENT_IN", quantity: qty,
          qtyOnHandBefore: fromBefore.qtyOnHand, qtyOnHandAfter: fromQtyOnHandAfter,
          qtyReservedBefore: fromBefore.qtyReserved, qtyReservedAfter: fromBefore.qtyReserved,
          reference: transfer.referenceNumber, referenceId: transfer.id,
          notes: `Transfer cancelled - stock returned to source`, createdById: userId,
        });
      }
      await tx.stockTransfer.update({ where: { id: transferId }, data: { status: "CANCELLED" } });
    });
  } else {
    await prisma.stockTransfer.update({ where: { id: transferId }, data: { status: "CANCELLED" } });
  }
}

// Instant transfer: source decreases, destination increases in one tx
export async function instantTransfer(data: {
  sourceLocationId: string; destinationLocationId: string; productId: string; companyId: string;
  quantity: number; notes?: string | null; createdById?: string | null; reference?: string | null; referenceId?: string | null;
  allowNegative?: boolean;
}): Promise<void> {
  if (data.sourceLocationId === data.destinationLocationId) throw new Error("Source and destination must differ");
  if (data.quantity <= 0) throw new Error("Quantity must be positive");
  await prisma.$transaction(async (tx) => {
    const fromBefore = await getOrCreateStockBalance(tx, data.productId, data.sourceLocationId, data.companyId);
    const toBefore = await getOrCreateStockBalance(tx, data.productId, data.destinationLocationId, data.companyId);
    const fromQtyOnHandAfter = fromBefore.qtyOnHand - data.quantity;
    if (fromQtyOnHandAfter < 0 && !data.allowNegative) throw new Error("Insufficient stock at source");
    await tx.stockBalance.update({
      where: { id: fromBefore.id },
      data: { qtyOnHand: fromQtyOnHandAfter, qtyAvailable: calcAvailable(fromQtyOnHandAfter, fromBefore.qtyReserved), lastMovementAt: new Date() },
    });
    const toQtyOnHandAfter = toBefore.qtyOnHand + data.quantity;
    await tx.stockBalance.update({
      where: { id: toBefore.id },
      data: { qtyOnHand: toQtyOnHandAfter, qtyAvailable: calcAvailable(toQtyOnHandAfter, toBefore.qtyReserved), lastMovementAt: new Date() },
    });
    await postStockLedger(tx, {
      productId: data.productId, locationId: data.sourceLocationId, companyId: data.companyId,
      movementType: "TRANSFER_OUT", quantity: data.quantity,
      qtyOnHandBefore: fromBefore.qtyOnHand, qtyOnHandAfter: fromQtyOnHandAfter,
      qtyReservedBefore: fromBefore.qtyReserved, qtyReservedAfter: fromBefore.qtyReserved,
      reference: data.reference ?? null, referenceId: data.referenceId ?? null,
      notes: `Instant transfer to ${data.destinationLocationId}`, createdById: data.createdById,
    });
    await postStockLedger(tx, {
      productId: data.productId, locationId: data.destinationLocationId, companyId: data.companyId,
      movementType: "TRANSFER_IN", quantity: data.quantity,
      qtyOnHandBefore: toBefore.qtyOnHand, qtyOnHandAfter: toQtyOnHandAfter,
      qtyReservedBefore: toBefore.qtyReserved, qtyReservedAfter: toBefore.qtyReserved,
      reference: data.reference ?? null, referenceId: data.referenceId ?? null,
      notes: `Instant transfer from ${data.sourceLocationId}`, createdById: data.createdById,
    });
  });
}

// ========== STOCK ADJUSTMENT MANAGEMENT ==========

export async function createStockAdjustment(data: {
  locationId: string; reason: AdjustmentReason; companyId: string; notes?: string | null;
  createdById: string; items: Array<{ productId: string; direction: "IN" | "OUT"; quantity: number; unitCost?: number }>;
}) {
  const count = await prisma.stockAdjustment.count({ where: { companyId: data.companyId } });
  const refNumber = `ADJ-${String(count + 1).padStart(5, "0")}`;
  return prisma.stockAdjustment.create({
    data: {
      referenceNumber: refNumber, locationId: data.locationId, reason: data.reason,
      companyId: data.companyId, notes: data.notes ?? null, createdById: data.createdById,
      items: { create: data.items.map((item) => ({ productId: item.productId, direction: item.direction, quantity: item.quantity, unitCost: item.unitCost ?? 0 })) },
    },
    include: { items: { include: { product: { select: { name: true, sku: true } } } } },
  });
}

export async function postStockAdjustment(adjustmentId: string, companyId: string, userId: string) {
  const adjustment = await prisma.stockAdjustment.findFirst({
    where: { id: adjustmentId, companyId }, include: { items: true },
  });
  if (!adjustment) throw new Error("Adjustment not found");
  if (adjustment.postedAt) throw new Error("Adjustment already posted");

  await prisma.$transaction(async (tx) => {
    for (const item of adjustment.items) {
      const before = await getOrCreateStockBalance(tx, item.productId, adjustment.locationId, companyId);
      const qty = Number(item.quantity);
      const direction = item.direction as "IN" | "OUT";
      const movementQty = direction === "IN" ? qty : -qty;
      const qtyOnHandAfter = before.qtyOnHand + movementQty;
      const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);
      const unitCost = Number(item.unitCost) || before.averageCost;
      const totalCost = Number(before.averageCost) * Number(before.qtyOnHand);
      const newTotalCost = direction === "IN" ? totalCost + qty * unitCost : totalCost - qty * unitCost;
      const newAvgCost = qtyOnHandAfter > 0 ? newTotalCost / qtyOnHandAfter : 0;

      await tx.stockBalance.update({
        where: { id: before.id },
        data: { qtyOnHand: qtyOnHandAfter, qtyAvailable: qtyAvailableAfter, averageCost: newAvgCost, lastMovementAt: new Date() },
      });

      const movementType: StockMovementType = direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
      await postStockLedger(tx, {
        productId: item.productId, locationId: adjustment.locationId, companyId,
        movementType, quantity: qty,
        qtyOnHandBefore: before.qtyOnHand, qtyOnHandAfter,
        qtyReservedBefore: before.qtyReserved, qtyReservedAfter: before.qtyReserved,
        reference: adjustment.referenceNumber, referenceId: adjustment.id,
        notes: `${adjustment.reason}${adjustment.notes ? ` - ${adjustment.notes}` : ""}`,
        createdById: userId,
      });
    }

    await tx.stockAdjustment.update({
      where: { id: adjustmentId },
      data: { postedAt: new Date() },
    });
  });
}

// ========== STOCK COUNT MANAGEMENT ==========

export async function createStockCount(data: {
  locationId: string; companyId: string; notes?: string | null; createdById: string;
}) {
  const count = await prisma.stockCount.count({ where: { companyId: data.companyId } });
  const refNumber = `SC-${String(count + 1).padStart(5, "0")}`;
  const balances = await prisma.stockBalance.findMany({
    where: { locationId: data.locationId, companyId: data.companyId },
    select: { productId: true, qtyOnHand: true },
  });
  return prisma.stockCount.create({
    data: {
      referenceNumber: refNumber, locationId: data.locationId, companyId: data.companyId,
      notes: data.notes ?? null, frozenAt: new Date(), status: "DRAFT", createdById: data.createdById,
      items: {
        create: balances.map((b) => ({
          productId: b.productId, expectedQty: b.qtyOnHand, countedQty: b.qtyOnHand, variance: 0,
        })),
      },
    },
    include: { items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } } },
  });
}

export async function updateStockCountItem(countId: string, itemId: string, countedQty: number, companyId: string) {
  const item = await prisma.stockCountItem.findFirst({
    where: { id: itemId, countId, count: { companyId } },
  });
  if (!item) throw new Error("Count item not found");
  const expectedQty = Number(item.expectedQty);
  const variance = countedQty - expectedQty;
  return prisma.stockCountItem.update({
    where: { id: itemId },
    data: { countedQty, variance },
  });
}

export async function reviewStockCount(countId: string, companyId: string, userId: string) {
  const count = await prisma.stockCount.findFirst({ where: { id: countId, companyId } });
  if (!count) throw new Error("Stock count not found");
  if (count.status !== "DRAFT" && count.status !== "IN_PROGRESS") {
    throw new Error("Stock count must be in DRAFT or IN_PROGRESS status to review");
  }
  return prisma.stockCount.update({
    where: { id: countId },
    data: { status: "REVIEWED", reviewedById: userId },
  });
}

export async function postStockCount(countId: string, companyId: string, userId: string) {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, companyId }, include: { items: true },
  });
  if (!count) throw new Error("Stock count not found");
  if (count.status !== "REVIEWED") throw new Error("Stock count must be reviewed before posting");

  await prisma.$transaction(async (tx) => {
    for (const item of count.items) {
      const variance = Number(item.variance);
      if (variance === 0) continue;
      const before = await getOrCreateStockBalance(tx, item.productId, count.locationId, companyId);
      const qtyOnHandAfter = before.qtyOnHand + variance;
      if (qtyOnHandAfter < 0) throw new Error("Stock count correction would cause negative stock");
      await tx.stockBalance.update({
        where: { id: before.id },
        data: { qtyOnHand: qtyOnHandAfter, qtyAvailable: calcAvailable(qtyOnHandAfter, before.qtyReserved), lastMovementAt: new Date() },
      });
      await postStockLedger(tx, {
        productId: item.productId, locationId: count.locationId, companyId,
        movementType: "STOCK_COUNT_CORRECTION", quantity: Math.abs(variance),
        qtyOnHandBefore: before.qtyOnHand, qtyOnHandAfter,
        qtyReservedBefore: before.qtyReserved, qtyReservedAfter: before.qtyReserved,
        reference: count.referenceNumber, referenceId: count.id,
        notes: `Stock count correction: expected ${item.expectedQty}, counted ${item.countedQty}`,
        createdById: userId,
      });
    }
    await tx.stockCount.update({
      where: { id: countId },
      data: { status: "POSTED", postedAt: new Date() },
    });
  });
}

// ========== LEDGER / HISTORY ==========

export async function getStockLedger(params: {
  companyId: string; productId?: string; locationId?: string; movementType?: string;
  dateFrom?: Date; dateTo?: Date; reference?: string; referenceId?: string; createdById?: string;
  page?: number; pageSize?: number;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 50;
  const where: Record<string, unknown> = { companyId: params.companyId };
  if (params.productId) where.productId = params.productId;
  if (params.locationId) where.locationId = params.locationId;
  if (params.movementType) where.movementType = params.movementType;
  if (params.reference) where.reference = { contains: params.reference, mode: "insensitive" };
  if (params.referenceId) where.referenceId = params.referenceId;
  if (params.createdById) where.createdById = params.createdById;
  if (params.dateFrom || params.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (params.dateFrom) createdAt.gte = params.dateFrom;
    if (params.dateTo) createdAt.lte = params.dateTo;
    where.createdAt = createdAt;
  }

  const [data, total] = await Promise.all([
    prisma.stockLedger.findMany({
      where: where as any,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockLedger.count({ where: where as any }),
  ]);

  return {
    data: data.map((entry) => ({
      id: entry.id, productId: entry.productId, productName: entry.product.name, productSku: entry.product.sku,
      locationId: entry.locationId, locationName: entry.location.name, locationType: entry.location.type,
      movementType: entry.movementType,
      quantity: Number(entry.quantity),
      qtyOnHandBefore: Number(entry.qtyOnHandBefore), qtyOnHandAfter: Number(entry.qtyOnHandAfter),
      qtyReservedBefore: Number(entry.qtyReservedBefore), qtyReservedAfter: Number(entry.qtyReservedAfter),
      reference: entry.reference, referenceId: entry.referenceId,
      notes: entry.notes, createdBy: entry.createdBy?.name ?? null, createdAt: entry.createdAt,
    })),
    total, page, pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getStockMovementTypes(companyId: string): Promise<string[]> {
  const types = await prisma.stockLedger.findMany({
    where: { companyId },
    distinct: ["movementType"],
    select: { movementType: true },
    orderBy: { movementType: "asc" },
  });
  return types.map((t) => t.movementType);
}

export async function getMovementTypeLabels(): Promise<Record<string, string>> {
  return {
    OPENING_BALANCE: "Opening Balance", PURCHASE_RECEIVE: "Purchase Receive",
    PURCHASE_RETURN: "Purchase Return", SALE: "Sale", SALE_RETURN: "Sale Return",
    TRANSFER_IN: "Transfer In", TRANSFER_OUT: "Transfer Out",
    ADJUSTMENT_IN: "Adjustment In", ADJUSTMENT_OUT: "Adjustment Out",
    RESERVATION: "Reservation", RESERVATION_RELEASE: "Reservation Release",
    STOCK_COUNT_CORRECTION: "Stock Count Correction",
    DAMAGE: "Damage", EXPIRY: "Expiry", LOST: "Lost", FOUND: "Found",
    INTERNAL_USE: "Internal Use", WRITE_OFF: "Write Off",
  };
}

// ========== INVENTORY DASHBOARD ==========

export async function getInventoryDashboard(companyId: string) {
  const [
    productCount, locationCount, totalBalances, pendingTransfers, recentLedger, productLots,
  ] = await Promise.all([
    prisma.product.count({ where: { companyId, deletedAt: null, isActive: true, isService: false } }),
    prisma.stockLocation.count({ where: { companyId, isActive: true } }),
    prisma.stockBalance.findMany({
      where: { companyId },
      include: {
        product: { select: { id: true, name: true, sku: true, sellingPrice: true, purchasePrice: true, minStock: true } },
        location: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.stockTransfer.count({ where: { companyId, status: { in: ["DRAFT", "ISSUED", "PARTIALLY_RECEIVED"] } as any } }),
    prisma.stockLedger.findMany({
      where: { companyId },
      include: { product: { select: { name: true } }, location: { select: { name: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: 10,
    }),
    prisma.productLot.findMany({
      where: { companyId, isActive: true, expiryDate: { not: null, lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) } },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { expiryDate: "asc" }, take: 20,
    }),
  ]);

  const totalStockQty = totalBalances.reduce((sum, b) => sum + Number(b.qtyOnHand), 0);
  const totalValue = totalBalances.reduce((sum, b) => {
    return sum + Number(b.qtyOnHand) * Number(b.averageCost);
  }, 0);
  const totalSkuWithStock = new Set(totalBalances.filter((b) => Number(b.qtyOnHand) > 0).map((b) => b.productId)).size;

  // Low stock based on StockBalance + Product.minStock
  const lowStockItems = totalBalances
    .filter((b) => Number(b.qtyOnHand) > 0 && Number(b.qtyOnHand) <= Number(b.product.minStock))
    .map((b) => ({
      productId: b.productId, productName: b.product.name, sku: b.product.sku,
      qtyOnHand: Number(b.qtyOnHand), minStock: Number(b.product.minStock), locationName: b.location.name,
    }))
    .slice(0, 20);

  const outOfStockCount = new Set(
    totalBalances.filter((b) => Number(b.qtyOnHand) === 0 && Number(b.product.minStock) > 0).map((b) => b.productId)
  ).size;

  // Stock by location
  const stockByLocationMap = new Map<string, { locationName: string; locationType: string; totalQty: number; totalValue: number; productCount: number }>();
  for (const b of totalBalances) {
    const locId = b.locationId;
    const existing = stockByLocationMap.get(locId) || {
      locationName: b.location.name, locationType: b.location.type,
      totalQty: 0, totalValue: 0, productCount: 0,
    };
    existing.totalQty += Number(b.qtyOnHand);
    existing.totalValue += Number(b.qtyOnHand) * Number(b.averageCost);
    existing.productCount += Number(b.qtyOnHand) > 0 ? 1 : 0;
    stockByLocationMap.set(locId, existing);
  }

  // Damaged store value
  const damagedBalances = totalBalances.filter((b) => b.location.type === "DAMAGED_STORE");
  const damagedStockValue = damagedBalances.reduce((s, b) => s + Number(b.qtyOnHand) * Number(b.averageCost), 0);

  // Employee custody stock value
  const employeeBalances = totalBalances.filter((b) => b.location.type === "EMPLOYEE_STORE");
  const employeeCustodyValue = employeeBalances.reduce((s, b) => s + Number(b.qtyOnHand) * Number(b.averageCost), 0);

  // Expiring batches
  const expiringLots = productLots.map((lot) => ({
    id: lot.id, lotNumber: lot.lotNumber, expiryDate: lot.expiryDate,
    productId: lot.productId, productName: lot.product.name, productSku: lot.product.sku,
    daysToExpire: lot.expiryDate ? Math.ceil((lot.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
  }));

  return {
    totalProducts: productCount,
    totalSkuWithStock,
    totalLocations: locationCount,
    totalStockQty,
    totalStockValue: totalValue,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    outOfStockCount,
    pendingTransferCount: pendingTransfers,
    damagedStockValue,
    employeeCustodyValue,
    expiringLots,
    recentMovements: recentLedger.map((l) => ({
      id: l.id, productName: l.product.name, locationName: l.location.name,
      movementType: l.movementType, quantity: Number(l.quantity),
      qtyOnHandAfter: Number(l.qtyOnHandAfter),
      createdBy: l.createdBy?.name ?? "System", createdAt: l.createdAt,
    })),
    stockByLocation: Array.from(stockByLocationMap.entries()).map(([locationId, data]) => ({ locationId, ...data })),
  };
}

// ========== LOCATION VALIDATION ==========

export async function validateLocationRules(locationId: string, companyId: string): Promise<{ valid: boolean; errors: string[] }> {
  const location = await prisma.stockLocation.findFirst({ where: { id: locationId, companyId } });
  if (!location) return { valid: false, errors: ["Location not found"] };
  const errors: string[] = [];
  if (location.type === "MAIN_WAREHOUSE" && location.branchId) errors.push("Main warehouse should not be linked to a branch");
  if ((location.type === "BRANCH_STORE" || location.type === "POS_STORE") && !location.branchId) errors.push("Branch store must be linked to a branch");
  if (location.type === "EMPLOYEE_STORE" && !location.assignedEmployeeId) errors.push("Employee store must be linked to an employee");
  return { valid: errors.length === 0, errors };
}
