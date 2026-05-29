import { PrismaClient, StockMovementType, TransferStatus, AdjustmentReason, StockCountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function calcAvailable(qtyOnHand: number, qtyReserved: number): number {
  const available = qtyOnHand - qtyReserved;
  return available < 0 ? 0 : available;
}

async function upsertBalance(
  tx: Tx,
  productId: string,
  locationId: string,
  companyId: string,
): Promise<{ id: string; qtyOnHand: number; qtyReserved: number; averageCost: number }> {
  const balance = await tx.stockBalance.upsert({
    where: { productId_locationId: { productId, locationId } },
    update: {},
    create: {
      productId,
      locationId,
      companyId,
      qtyOnHand: 0,
      qtyReserved: 0,
      qtyAvailable: 0,
      averageCost: 0,
    },
  });
  return {
    id: balance.id,
    qtyOnHand: Number(balance.qtyOnHand),
    qtyReserved: Number(balance.qtyReserved),
    averageCost: Number(balance.averageCost),
  };
}

async function createLedger(
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

// ========== READ FUNCTIONS ==========

export async function getStockBalance(
  productId: string,
  locationId: string,
  companyId: string,
): Promise<{ qtyOnHand: number; qtyReserved: number; qtyAvailable: number; averageCost: number } | null> {
  const balance = await prisma.stockBalance.findUnique({
    where: { productId_locationId: { productId, locationId } },
  });
  if (!balance) return null;
  return {
    qtyOnHand: Number(balance.qtyOnHand),
    qtyReserved: Number(balance.qtyReserved),
    qtyAvailable: Number(balance.qtyAvailable),
    averageCost: Number(balance.averageCost),
  };
}

export async function getProductStockByLocations(
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
    where: { productId_locationId: { productId, locationId } },
  });
  const onHand = balance ? Number(balance.qtyOnHand) : 0;
  const reserved = balance ? Number(balance.qtyReserved) : 0;
  const available = calcAvailable(onHand, reserved);

  if (allowNegative) return { valid: true, available, onHand };
  if (quantity > available) return { valid: false, available, onHand };
  return { valid: true, available, onHand };
}

// ========== WRITE FUNCTIONS ==========

export async function adjustStock(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    direction: "IN" | "OUT";
    reason?: string | null;
    notes?: string | null;
    createdById?: string | null;
    unitCost?: number;
    allowNegative?: boolean;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
    const movementType: StockMovementType =
      params.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
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

    await createLedger(tx, {
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

export async function transferStock(
  params: {
    fromLocationId: string;
    toLocationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    notes?: string | null;
    createdById?: string | null;
    reference?: string | null;
    referenceId?: string | null;
    allowNegative?: boolean;
  },
): Promise<void> {
  if (params.fromLocationId === params.toLocationId) throw new Error("Source and destination locations must differ");
  if (params.quantity <= 0) throw new Error("Quantity must be positive");

  await prisma.$transaction(async (tx) => {
    const fromBefore = await upsertBalance(tx, params.productId, params.fromLocationId, params.companyId);
    const toBefore = await upsertBalance(tx, params.productId, params.toLocationId, params.companyId);

    const fromQtyOnHandAfter = fromBefore.qtyOnHand - params.quantity;
    if (fromQtyOnHandAfter < 0 && !params.allowNegative) throw new Error("Insufficient stock at source location");
    const fromQtyAvailableAfter = calcAvailable(fromQtyOnHandAfter, fromBefore.qtyReserved);

    const toQtyOnHandAfter = toBefore.qtyOnHand + params.quantity;
    const toQtyAvailableAfter = calcAvailable(toQtyOnHandAfter, toBefore.qtyReserved);

    await tx.stockBalance.update({
      where: { id: fromBefore.id },
      data: { qtyOnHand: fromQtyOnHandAfter, qtyAvailable: fromQtyAvailableAfter, lastMovementAt: new Date() },
    });
    await tx.stockBalance.update({
      where: { id: toBefore.id },
      data: { qtyOnHand: toQtyOnHandAfter, qtyAvailable: toQtyAvailableAfter, lastMovementAt: new Date() },
    });

    await createLedger(tx, {
      productId: params.productId,
      locationId: params.fromLocationId,
      companyId: params.companyId,
      movementType: "TRANSFER_OUT",
      quantity: params.quantity,
      qtyOnHandBefore: fromBefore.qtyOnHand,
      qtyOnHandAfter: fromQtyOnHandAfter,
      qtyReservedBefore: fromBefore.qtyReserved,
      qtyReservedAfter: fromBefore.qtyReserved,
      reference: params.reference ?? null,
      referenceId: params.referenceId ?? null,
      notes: `Transfer to ${params.toLocationId}`,
      createdById: params.createdById,
    });
    await createLedger(tx, {
      productId: params.productId,
      locationId: params.toLocationId,
      companyId: params.companyId,
      movementType: "TRANSFER_IN",
      quantity: params.quantity,
      qtyOnHandBefore: toBefore.qtyOnHand,
      qtyOnHandAfter: toQtyOnHandAfter,
      qtyReservedBefore: toBefore.qtyReserved,
      qtyReservedAfter: toBefore.qtyReserved,
      reference: params.reference ?? null,
      referenceId: params.referenceId ?? null,
      notes: `Transfer from ${params.fromLocationId}`,
      createdById: params.createdById,
    });
  });
}

export async function reserveStock(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    reference?: string | null;
    referenceId?: string | null;
    createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");

  await prisma.$transaction(async (tx) => {
    const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
    const available = calcAvailable(before.qtyOnHand, before.qtyReserved);
    if (available < params.quantity) throw new Error("Insufficient available stock for reservation");

    const qtyReservedAfter = before.qtyReserved + params.quantity;
    const qtyAvailableAfter = calcAvailable(before.qtyOnHand, qtyReservedAfter);

    await tx.stockBalance.update({
      where: { id: before.id },
      data: { qtyReserved: qtyReservedAfter, qtyAvailable: qtyAvailableAfter },
    });

    await createLedger(tx, {
      productId: params.productId,
      locationId: params.locationId,
      companyId: params.companyId,
      movementType: "RESERVATION",
      quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand,
      qtyOnHandAfter: before.qtyOnHand,
      qtyReservedBefore: before.qtyReserved,
      qtyReservedAfter,
      reference: params.reference ?? null,
      referenceId: params.referenceId ?? null,
      createdById: params.createdById,
    });
  });
}

export async function releaseReservedStock(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    reference?: string | null;
    referenceId?: string | null;
    createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");

  await prisma.$transaction(async (tx) => {
    const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyReservedAfter = before.qtyReserved - params.quantity;
    if (qtyReservedAfter < 0) throw new Error("Cannot release more than reserved");
    const qtyAvailableAfter = calcAvailable(before.qtyOnHand, qtyReservedAfter);

    await tx.stockBalance.update({
      where: { id: before.id },
      data: { qtyReserved: qtyReservedAfter, qtyAvailable: qtyAvailableAfter },
    });

    await createLedger(tx, {
      productId: params.productId,
      locationId: params.locationId,
      companyId: params.companyId,
      movementType: "RESERVATION_RELEASE",
      quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand,
      qtyOnHandAfter: before.qtyOnHand,
      qtyReservedBefore: before.qtyReserved,
      qtyReservedAfter,
      reference: params.reference ?? null,
      referenceId: params.referenceId ?? null,
      createdById: params.createdById,
    });
  });
}

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

  const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
  const qtyOnHandAfter = before.qtyOnHand - params.quantity;
  if (qtyOnHandAfter < 0 && !params.allowNegative) throw new Error("Insufficient stock for sale");

  const reserveRelease = Math.min(params.quantity, before.qtyReserved);
  const qtyReservedAfter = before.qtyReserved - reserveRelease;
  const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, qtyReservedAfter);

  await tx.stockBalance.update({
    where: { id: before.id },
    data: {
      qtyOnHand: qtyOnHandAfter,
      qtyReserved: qtyReservedAfter,
      qtyAvailable: qtyAvailableAfter,
      lastMovementAt: new Date(),
    },
  });

  await createLedger(tx, {
    productId: params.productId,
    locationId: params.locationId,
    companyId: params.companyId,
    movementType: "SALE",
    quantity: params.quantity,
    qtyOnHandBefore: before.qtyOnHand,
    qtyOnHandAfter,
    qtyReservedBefore: before.qtyReserved,
    qtyReservedAfter,
    reference: params.reference ?? null,
    referenceId: params.referenceId ?? null,
    createdById: params.createdById,
  });
}

export async function consumeStockForSale(
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
  await prisma.$transaction(async (tx) => {
    await consumeStockForSaleTx(tx, params);
  });
}

export async function receiveStockForPurchaseTx(
  tx: Tx,
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    unitCost?: number;
    reference?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");

  const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
  const qtyOnHandAfter = before.qtyOnHand + params.quantity;
  const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);

  const unitCost = params.unitCost ?? 0;
  const totalCost = Number(before.averageCost) * Number(before.qtyOnHand);
  const newTotalCost = totalCost + params.quantity * unitCost;
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

  await createLedger(tx, {
    productId: params.productId,
    locationId: params.locationId,
    companyId: params.companyId,
    movementType: "PURCHASE_RECEIVE",
    quantity: params.quantity,
    qtyOnHandBefore: before.qtyOnHand,
    qtyOnHandAfter,
    qtyReservedBefore: before.qtyReserved,
    qtyReservedAfter: before.qtyReserved,
    reference: params.reference ?? null,
    referenceId: params.referenceId ?? null,
    notes: params.notes ?? null,
    createdById: params.createdById,
  });
}

export async function receiveStockForPurchase(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    unitCost?: number;
    reference?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    createdById?: string | null;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await receiveStockForPurchaseTx(tx, params);
  });
}

export async function returnSaleStock(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    unitCost?: number;
    reference?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");

  await prisma.$transaction(async (tx) => {
    const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyOnHandAfter = before.qtyOnHand + params.quantity;
    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);

    const unitCost = params.unitCost ?? before.averageCost;
    const totalCost = Number(before.averageCost) * Number(before.qtyOnHand);
    const newTotalCost = totalCost + params.quantity * unitCost;
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

    await createLedger(tx, {
      productId: params.productId,
      locationId: params.locationId,
      companyId: params.companyId,
      movementType: "SALE_RETURN",
      quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand,
      qtyOnHandAfter,
      qtyReservedBefore: before.qtyReserved,
      qtyReservedAfter: before.qtyReserved,
      reference: params.reference ?? null,
      referenceId: params.referenceId ?? null,
      notes: params.notes ?? null,
      createdById: params.createdById,
    });
  });
}

export async function returnPurchaseStock(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    reference?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    createdById?: string | null;
    allowNegative?: boolean;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Quantity must be positive");

  await prisma.$transaction(async (tx) => {
    const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyOnHandAfter = before.qtyOnHand - params.quantity;
    if (qtyOnHandAfter < 0 && !params.allowNegative) throw new Error("Insufficient stock for purchase return");
    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);

    await tx.stockBalance.update({
      where: { id: before.id },
      data: {
        qtyOnHand: qtyOnHandAfter,
        qtyAvailable: qtyAvailableAfter,
        lastMovementAt: new Date(),
      },
    });

    await createLedger(tx, {
      productId: params.productId,
      locationId: params.locationId,
      companyId: params.companyId,
      movementType: "PURCHASE_RETURN",
      quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand,
      qtyOnHandAfter,
      qtyReservedBefore: before.qtyReserved,
      qtyReservedAfter: before.qtyReserved,
      reference: params.reference ?? null,
      referenceId: params.referenceId ?? null,
      notes: params.notes ?? null,
      createdById: params.createdById,
    });
  });
}

export async function postStockCountCorrection(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    expectedQty: number;
    countedQty: number;
    notes?: string | null;
    createdById?: string | null;
    countReferenceId?: string | null;
  },
): Promise<void> {
  const variance = params.countedQty - params.expectedQty;
  if (variance === 0) return;

  await prisma.$transaction(async (tx) => {
    const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyOnHandAfter = before.qtyOnHand + variance;
    if (qtyOnHandAfter < 0) throw new Error("Stock count correction would cause negative stock");

    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);

    await tx.stockBalance.update({
      where: { id: before.id },
      data: {
        qtyOnHand: qtyOnHandAfter,
        qtyAvailable: qtyAvailableAfter,
        lastMovementAt: new Date(),
      },
    });

    await createLedger(tx, {
      productId: params.productId,
      locationId: params.locationId,
      companyId: params.companyId,
      movementType: "STOCK_COUNT_CORRECTION",
      quantity: Math.abs(variance),
      qtyOnHandBefore: before.qtyOnHand,
      qtyOnHandAfter,
      qtyReservedBefore: before.qtyReserved,
      qtyReservedAfter: before.qtyReserved,
      reference: "Stock Count",
      referenceId: params.countReferenceId ?? null,
      notes: params.notes ?? `Count correction: expected ${params.expectedQty}, counted ${params.countedQty}`,
      createdById: params.createdById,
    });
  });
}

export async function openingBalance(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    unitCost?: number;
    createdById?: string | null;
  },
): Promise<void> {
  if (params.quantity <= 0) throw new Error("Opening balance must be positive");

  await prisma.$transaction(async (tx) => {
    const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
    const qtyOnHandAfter = before.qtyOnHand + params.quantity;
    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);

    const unitCost = params.unitCost ?? 0;
    const totalCost = Number(before.averageCost) * Number(before.qtyOnHand);
    const newTotalCost = totalCost + params.quantity * unitCost;
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

    await createLedger(tx, {
      productId: params.productId,
      locationId: params.locationId,
      companyId: params.companyId,
      movementType: "OPENING_BALANCE",
      quantity: params.quantity,
      qtyOnHandBefore: before.qtyOnHand,
      qtyOnHandAfter,
      qtyReservedBefore: before.qtyReserved,
      qtyReservedAfter: before.qtyReserved,
      notes: "Opening balance",
      createdById: params.createdById,
    });
  });
}

// ========== LOCATION MANAGEMENT ==========

export async function createInventoryLocation(data: {
  name: string;
  code: string;
  type: string;
  branchId?: string | null;
  assignedEmployeeId?: string | null;
  companyId: string;
  isDefault?: boolean;
  isSellable?: boolean;
  address?: string | null;
  notes?: string | null;
}) {
  if (data.type === "MAIN_WAREHOUSE" && data.branchId) {
    data.branchId = null;
  }
  if ((data.type === "BRANCH_STORE" || data.type === "POS_STORE") && !data.branchId) {
    throw new Error("Branch store or POS store must be linked to a branch");
  }
  if (data.type === "EMPLOYEE_STORE" && !data.assignedEmployeeId) {
    throw new Error("Employee store must be linked to an employee");
  }

  const location = await prisma.stockLocation.create({
    data: {
      name: data.name,
      code: data.code,
      type: data.type as any,
      branchId: data.branchId ?? null,
      assignedEmployeeId: data.assignedEmployeeId ?? null,
      companyId: data.companyId,
      isDefault: data.isDefault ?? false,
      isSellable: data.isSellable ?? true,
      address: data.address ?? null,
      notes: data.notes ?? null,
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
  return prisma.stockLocation.update({
    where: { id, companyId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.type !== undefined && { type: data.type as any }),
      ...(data.branchId !== undefined && { branchId: data.branchId ?? null }),
      ...(data.assignedEmployeeId !== undefined && { assignedEmployeeId: data.assignedEmployeeId ?? null }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.isSellable !== undefined && { isSellable: data.isSellable }),
      ...(data.address !== undefined && { address: data.address ?? null }),
      ...(data.notes !== undefined && { notes: data.notes ?? null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

// ========== STOCK TRANSFER MANAGEMENT ==========

export async function createStockTransfer(data: {
  sourceLocationId: string;
  destinationLocationId: string;
  companyId: string;
  notes?: string | null;
  createdById: string;
  items: Array<{ productId: string; quantity: number }>;
}) {
  if (data.sourceLocationId === data.destinationLocationId) {
    throw new Error("Source and destination locations must differ");
  }

  const count = await prisma.stockTransfer.count({ where: { companyId: data.companyId } });
  const refNumber = `TRF-${String(count + 1).padStart(5, "0")}`;

  const transfer = await prisma.$transaction(async (tx) => {
    for (const item of data.items) {
      const bal = await tx.stockBalance.findUnique({
        where: { productId_locationId: { productId: item.productId, locationId: data.sourceLocationId } },
      });
      const onHand = bal ? Number(bal.qtyOnHand) : 0;
      if (onHand < item.quantity) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true } });
        throw new Error(`Insufficient stock for "${product?.name ?? item.productId}" at source location`);
      }
    }

    return tx.stockTransfer.create({
      data: {
        referenceNumber: refNumber,
        sourceLocationId: data.sourceLocationId,
        destinationLocationId: data.destinationLocationId,
        status: "PENDING",
        companyId: data.companyId,
        notes: data.notes ?? null,
        createdById: data.createdById,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: { include: { product: { select: { name: true, sku: true } } } } },
    });
  });

  return transfer;
}

export async function receiveStockTransfer(
  transferId: string,
  companyId: string,
  userId: string,
) {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId, companyId },
    include: { items: true },
  });
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "PENDING" && transfer.status !== "IN_TRANSIT") {
    throw new Error(`Transfer cannot be received in status: ${transfer.status}`);
  }

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      const qty = Number(item.quantity);
      const fromBefore = await upsertBalance(tx, item.productId, transfer.sourceLocationId, companyId);
      const toBefore = await upsertBalance(tx, item.productId, transfer.destinationLocationId, companyId);

      const fromQtyOnHandAfter = fromBefore.qtyOnHand - qty;
      if (fromQtyOnHandAfter < 0) throw new Error("Insufficient stock at source for transfer");

      await tx.stockBalance.update({
        where: { id: fromBefore.id },
        data: {
          qtyOnHand: fromQtyOnHandAfter,
          qtyAvailable: calcAvailable(fromQtyOnHandAfter, fromBefore.qtyReserved),
          lastMovementAt: new Date(),
        },
      });
      await tx.stockBalance.update({
        where: { id: toBefore.id },
        data: {
          qtyOnHand: toBefore.qtyOnHand + qty,
          qtyAvailable: calcAvailable(toBefore.qtyOnHand + qty, toBefore.qtyReserved),
          lastMovementAt: new Date(),
        },
      });

      await createLedger(tx, {
        productId: item.productId,
        locationId: transfer.sourceLocationId,
        companyId,
        movementType: "TRANSFER_OUT",
        quantity: qty,
        qtyOnHandBefore: fromBefore.qtyOnHand,
        qtyOnHandAfter: fromQtyOnHandAfter,
        qtyReservedBefore: fromBefore.qtyReserved,
        qtyReservedAfter: fromBefore.qtyReserved,
        reference: transfer.referenceNumber,
        referenceId: transfer.id,
        notes: `Transfer to ${transfer.destinationLocationId}`,
        createdById: userId,
      });
      await createLedger(tx, {
        productId: item.productId,
        locationId: transfer.destinationLocationId,
        companyId,
        movementType: "TRANSFER_IN",
        quantity: qty,
        qtyOnHandBefore: toBefore.qtyOnHand,
        qtyOnHandAfter: toBefore.qtyOnHand + qty,
        qtyReservedBefore: toBefore.qtyReserved,
        qtyReservedAfter: toBefore.qtyReserved,
        reference: transfer.referenceNumber,
        referenceId: transfer.id,
        notes: `Transfer from ${transfer.sourceLocationId}`,
        createdById: userId,
      });
    }

    await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: "COMPLETED", receivedAt: new Date() },
    });
  });
}

export async function cancelStockTransfer(
  transferId: string,
  companyId: string,
) {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId, companyId },
  });
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status === "COMPLETED" || transfer.status === "CANCELLED") {
    throw new Error("Cannot cancel a completed or already cancelled transfer");
  }

  return prisma.stockTransfer.update({
    where: { id: transferId },
    data: { status: "CANCELLED" },
  });
}

// ========== STOCK ADJUSTMENT MANAGEMENT ==========

export async function createStockAdjustment(data: {
  locationId: string;
  reason: AdjustmentReason;
  companyId: string;
  notes?: string | null;
  createdById: string;
  items: Array<{ productId: string; direction: "IN" | "OUT"; quantity: number; unitCost?: number }>;
}) {
  const count = await prisma.stockAdjustment.count({ where: { companyId: data.companyId } });
  const refNumber = `ADJ-${String(count + 1).padStart(5, "0")}`;

  const adjustment = await prisma.$transaction(async (tx) => {
    const created = await tx.stockAdjustment.create({
      data: {
        referenceNumber: refNumber,
        locationId: data.locationId,
        reason: data.reason,
        companyId: data.companyId,
        notes: data.notes ?? null,
        createdById: data.createdById,
        postedAt: new Date(),
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            direction: item.direction,
            quantity: item.quantity,
            unitCost: item.unitCost ?? 0,
          })),
        },
      },
      include: { items: { include: { product: { select: { name: true, sku: true } } } } },
    });

    for (const item of data.items) {
      await adjustStock({
        locationId: data.locationId,
        productId: item.productId,
        companyId: data.companyId,
        quantity: item.quantity,
        direction: item.direction,
        reason: data.reason,
        notes: data.notes ?? `Adjustment ${refNumber}`,
        createdById: data.createdById,
        unitCost: item.unitCost,
      });
    }

    return created;
  });

  return adjustment;
}

// ========== STOCK COUNT MANAGEMENT ==========

export async function createStockCount(data: {
  locationId: string;
  companyId: string;
  notes?: string | null;
  createdById: string;
}) {
  const count = await prisma.stockCount.count({ where: { companyId: data.companyId } });
  const refNumber = `SC-${String(count + 1).padStart(5, "0")}`;

  const balances = await prisma.stockBalance.findMany({
    where: { locationId: data.locationId, companyId: data.companyId },
    select: { productId: true, qtyOnHand: true },
  });

  const snapshot = await prisma.stockCount.create({
    data: {
      referenceNumber: refNumber,
      locationId: data.locationId,
      companyId: data.companyId,
      notes: data.notes ?? null,
      frozenAt: new Date(),
      status: "DRAFT",
      createdById: data.createdById,
      items: {
        create: balances.map((b) => ({
          productId: b.productId,
          expectedQty: b.qtyOnHand,
          countedQty: b.qtyOnHand,
          variance: 0,
        })),
      },
    },
    include: { items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } } },
  });

  return snapshot;
}

export async function updateStockCountItem(
  countId: string,
  itemId: string,
  countedQty: number,
  companyId: string,
) {
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

export async function postStockCount(
  countId: string,
  companyId: string,
  userId: string,
) {
  const count = await prisma.stockCount.findUnique({
    where: { id: countId, companyId },
    include: { items: true },
  });
  if (!count) throw new Error("Stock count not found");
  if (count.status !== "REVIEWED") throw new Error("Stock count must be reviewed before posting");

  await prisma.$transaction(async (tx) => {
    for (const item of count.items) {
      const variance = Number(item.variance);
      if (variance === 0) continue;

      const fromLocationId = count.locationId;
      const before = await upsertBalance(tx, item.productId, fromLocationId, companyId);
      const qtyOnHandAfter = before.qtyOnHand + variance;
      if (qtyOnHandAfter < 0) throw new Error("Stock count correction would cause negative stock");

      await tx.stockBalance.update({
        where: { id: before.id },
        data: {
          qtyOnHand: qtyOnHandAfter,
          qtyAvailable: calcAvailable(qtyOnHandAfter, before.qtyReserved),
          lastMovementAt: new Date(),
        },
      });

      await createLedger(tx, {
        productId: item.productId,
        locationId: fromLocationId,
        companyId,
        movementType: "STOCK_COUNT_CORRECTION",
        quantity: Math.abs(variance),
        qtyOnHandBefore: before.qtyOnHand,
        qtyOnHandAfter,
        qtyReservedBefore: before.qtyReserved,
        qtyReservedAfter: before.qtyReserved,
        reference: count.referenceNumber,
        referenceId: count.id,
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

export async function reviewStockCount(
  countId: string,
  companyId: string,
  userId: string,
) {
  const count = await prisma.stockCount.findUnique({
    where: { id: countId, companyId },
  });
  if (!count) throw new Error("Stock count not found");
  if (count.status !== "IN_PROGRESS" && count.status !== "DRAFT") {
    throw new Error("Stock count must be in DRAFT or IN_PROGRESS status to review");
  }

  return prisma.stockCount.update({
    where: { id: countId },
    data: { status: "REVIEWED", reviewedById: userId },
  });
}

// ========== LEDGER / HISTORY ==========

export async function getStockLedger(params: {
  companyId: string;
  productId?: string;
  locationId?: string;
  movementType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 50;
  const where: Record<string, unknown> = { companyId: params.companyId };

  if (params.productId) where.productId = params.productId;
  if (params.locationId) where.locationId = params.locationId;
  if (params.movementType) where.movementType = params.movementType;
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
      id: entry.id,
      productId: entry.productId,
      productName: entry.product.name,
      productSku: entry.product.sku,
      locationId: entry.locationId,
      locationName: entry.location.name,
      locationType: entry.location.type,
      movementType: entry.movementType,
      quantity: Number(entry.quantity),
      qtyOnHandBefore: Number(entry.qtyOnHandBefore),
      qtyOnHandAfter: Number(entry.qtyOnHandAfter),
      qtyReservedBefore: Number(entry.qtyReservedBefore),
      qtyReservedAfter: Number(entry.qtyReservedAfter),
      reference: entry.reference,
      referenceId: entry.referenceId,
      notes: entry.notes,
      createdBy: entry.createdBy?.name ?? null,
      createdAt: entry.createdAt,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getInventoryDashboard(companyId: string) {
  const [
    productCount,
    locationCount,
    totalBalances,
    lowStockItems,
    outOfStockItems,
    pendingTransfers,
    recentLedger,
  ] = await Promise.all([
    prisma.product.count({ where: { companyId, deletedAt: null, isActive: true, isService: false } }),
    prisma.stockLocation.count({ where: { companyId, isActive: true } }),
    prisma.stockBalance.findMany({
      where: { companyId },
      include: { product: { select: { id: true, name: true, sellingPrice: true, purchasePrice: true } }, location: { select: { id: true, name: true } } },
    }),
    prisma.$queryRaw<Array<{ id: string; name: string; sku: string | null; stock: number; minStock: number }>>`
      SELECT id, name, sku, stock, "minStock"
      FROM products
      WHERE "companyId" = ${companyId}
        AND "deletedAt" IS NULL
        AND "isActive" = true
        AND "isService" = false
        AND stock > 0
        AND stock <= "minStock"
      LIMIT 20
    `.then((rows) => rows.map((r) => ({ ...r, stock: Number(r.stock), minStock: Number(r.minStock) }))),
    prisma.product.count({
      where: { companyId, deletedAt: null, isActive: true, isService: false, stock: 0 },
    }),
    prisma.stockTransfer.count({
      where: { companyId, status: { in: ["PENDING", "IN_TRANSIT"] as any } },
    }),
    prisma.stockLedger.findMany({
      where: { companyId },
      include: {
        product: { select: { name: true } },
        location: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalValue = totalBalances.reduce((sum, b) => {
    const product = b as any;
    return sum + Number(b.qtyOnHand) * Number(product.product?.sellingPrice || 0);
  }, 0);
  const totalStockQty = totalBalances.reduce((sum, b) => sum + Number(b.qtyOnHand), 0);
  const totalSkuWithStock = new Set(totalBalances.filter((b) => Number(b.qtyOnHand) > 0).map((b) => b.productId)).size;

  const stockByLocation = new Map<string, { locationName: string; totalQty: number; totalValue: number; productCount: number }>();
  for (const b of totalBalances) {
    const locId = b.locationId;
    const existing = stockByLocation.get(locId) || { locationName: b.location.name, totalQty: 0, totalValue: 0, productCount: 0 };
    existing.totalQty += Number(b.qtyOnHand);
    const brec = b as any;
    existing.totalValue += Number(brec.qtyOnHand) * Number(brec.product?.sellingPrice || 0);
    existing.productCount += 1;
    stockByLocation.set(locId, existing);
  }

  return {
    totalProducts: productCount,
    totalSkuWithStock,
    totalLocations: locationCount,
    totalStockQty,
    totalStockValue: totalValue,
    lowStockCount: lowStockItems.length,
    lowStockItems: lowStockItems.slice(0, 10),
    outOfStockCount: outOfStockItems,
    pendingTransferCount: pendingTransfers,
    recentMovements: recentLedger.map((l) => ({
      id: l.id,
      productName: l.product.name,
      locationName: l.location.name,
      movementType: l.movementType,
      quantity: Number(l.quantity),
      qtyOnHandAfter: Number(l.qtyOnHandAfter),
      createdBy: l.createdBy?.name ?? "System",
      createdAt: l.createdAt,
    })),
    stockByLocation: Array.from(stockByLocation.entries()).map(([id, data]) => ({ locationId: id, ...data })),
  };
}

// ========== LOCATION GEOFENCING / RULES ==========

export async function validateLocationRules(
  locationId: string,
  companyId: string,
): Promise<{ valid: boolean; errors: string[] }> {
  const location = await prisma.stockLocation.findUnique({ where: { id: locationId, companyId } });
  if (!location) return { valid: false, errors: ["Location not found"] };

  const errors: string[] = [];
  if (location.type === "MAIN_WAREHOUSE") {
    if (location.branchId) errors.push("Main warehouse should not be linked to a branch");
  } else if (location.type === "BRANCH_STORE" || location.type === "POS_STORE") {
    if (!location.branchId) errors.push("Branch store must be linked to a branch");
    if (location.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: location.branchId } });
      if (!branch || branch.companyId !== companyId) errors.push("Linked branch not found or invalid");
    }
  } else if (location.type === "EMPLOYEE_STORE") {
    if (!location.assignedEmployeeId) errors.push("Employee store must be linked to an employee");
  }

  return { valid: errors.length === 0, errors };
}
