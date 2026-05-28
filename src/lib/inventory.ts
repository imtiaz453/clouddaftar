import { PrismaClient, StockMovementType } from "@prisma/client";
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
): Promise<{ id: string; qtyOnHand: number; qtyReserved: number }> {
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
    },
  });
  return { id: balance.id, qtyOnHand: Number(balance.qtyOnHand), qtyReserved: Number(balance.qtyReserved) };
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

export async function getProductStockByLocation(
  productId: string,
  locationId: string,
  companyId: string,
): Promise<{ qtyOnHand: number; qtyReserved: number; qtyAvailable: number } | null> {
  const balance = await prisma.stockBalance.findUnique({
    where: { productId_locationId: { productId, locationId } },
  });
  if (!balance) return null;
  return {
    qtyOnHand: Number(balance.qtyOnHand),
    qtyReserved: Number(balance.qtyReserved),
    qtyAvailable: Number(balance.qtyAvailable),
  };
}

export async function getProductStockAllLocations(
  productId: string,
  companyId: string,
): Promise<Array<{ locationId: string; locationName: string; qtyOnHand: number; qtyReserved: number; qtyAvailable: number }>> {
  const balances = await prisma.stockBalance.findMany({
    where: { productId, companyId },
    include: { location: { select: { name: true } } },
  });
  return balances.map((b) => ({
    locationId: b.locationId,
    locationName: b.location.name,
    qtyOnHand: Number(b.qtyOnHand),
    qtyReserved: Number(b.qtyReserved),
    qtyAvailable: Number(b.qtyAvailable),
  }));
}

export async function getLocationStock(
  locationId: string,
  companyId: string,
): Promise<Array<{ productId: string; productName: string; sku: string | null; qtyOnHand: number; qtyReserved: number; qtyAvailable: number }>> {
  const balances = await prisma.stockBalance.findMany({
    where: { locationId, companyId },
    include: { product: { select: { name: true, sku: true } } },
  });
  return balances.map((b) => ({
    productId: b.productId,
    productName: b.product.name,
    sku: b.product.sku,
    qtyOnHand: Number(b.qtyOnHand),
    qtyReserved: Number(b.qtyReserved),
    qtyAvailable: Number(b.qtyAvailable),
  }));
}

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
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await upsertBalance(tx, params.productId, params.locationId, params.companyId);
    const movementType = params.direction === "IN" ? "ADJUSTMENT_IN" as StockMovementType : "ADJUSTMENT_OUT" as StockMovementType;
    const qty = params.direction === "IN" ? params.quantity : -params.quantity;
    const qtyOnHandAfter = before.qtyOnHand + qty;
    if (qtyOnHandAfter < 0) throw new Error("Insufficient stock");
    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, before.qtyReserved);

    await tx.stockBalance.update({
      where: { id: before.id },
      data: {
        qtyOnHand: qtyOnHandAfter,
        qtyAvailable: qtyAvailableAfter,
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
      notes: params.reason ? `${params.reason}${params.notes ? ` - ${params.notes}` : ""}` : params.notes,
      createdById: params.createdById,
    });
  });
}

export async function moveStock(
  params: {
    fromLocationId: string;
    toLocationId: string;
    productId: string;
    companyId: string;
    quantity: number;
    notes?: string | null;
    createdById?: string | null;
  },
): Promise<void> {
  if (params.fromLocationId === params.toLocationId) throw new Error("Source and destination locations must differ");
  if (params.quantity <= 0) throw new Error("Quantity must be positive");

  await prisma.$transaction(async (tx) => {
    const fromBefore = await upsertBalance(tx, params.productId, params.fromLocationId, params.companyId);
    const toBefore = await upsertBalance(tx, params.productId, params.toLocationId, params.companyId);

    const fromQtyOnHandAfter = fromBefore.qtyOnHand - params.quantity;
    if (fromQtyOnHandAfter < 0) throw new Error("Insufficient stock at source location");
    const fromQtyAvailableAfter = calcAvailable(fromQtyOnHandAfter, fromBefore.qtyReserved);

    const toQtyOnHandAfter = toBefore.qtyOnHand + params.quantity;
    const toQtyAvailableAfter = calcAvailable(toQtyOnHandAfter, toBefore.qtyReserved);

    await tx.stockBalance.update({
      where: { id: fromBefore.id },
      data: { qtyOnHand: fromQtyOnHandAfter, qtyAvailable: fromQtyAvailableAfter },
    });
    await tx.stockBalance.update({
      where: { id: toBefore.id },
      data: { qtyOnHand: toQtyOnHandAfter, qtyAvailable: toQtyAvailableAfter },
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
      reference: params.notes ?? null,
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
      reference: params.notes ?? null,
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

export async function consumeStockForSale(
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
    const qtyOnHandAfter = before.qtyOnHand - params.quantity;
    if (qtyOnHandAfter < 0) throw new Error("Insufficient stock for sale");

    const reserveRelease = Math.min(params.quantity, before.qtyReserved);
    const qtyReservedAfter = before.qtyReserved - reserveRelease;
    const qtyAvailableAfter = calcAvailable(qtyOnHandAfter, qtyReservedAfter);

    await tx.stockBalance.update({
      where: { id: before.id },
      data: {
        qtyOnHand: qtyOnHandAfter,
        qtyReserved: qtyReservedAfter,
        qtyAvailable: qtyAvailableAfter,
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
  });
}

export async function receiveStockForPurchase(
  params: {
    locationId: string;
    productId: string;
    companyId: string;
    quantity: number;
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

    await tx.stockBalance.update({
      where: { id: before.id },
      data: { qtyOnHand: qtyOnHandAfter, qtyAvailable: qtyAvailableAfter },
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
  });
}
