"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";
import {
  getPrefixForKind,
  isLegacyDraftDocumentNumber,
  reserveNextDocumentNumber,
} from "@/lib/document-numbers";
import { createAuditLog, createNotification } from "@/lib/audit";
import { sendPushNotificationWithAdmins } from "@/lib/push";
import {
  computePaymentStatus,
  createLedgerEntry,
  recalculateLedgerBalances,
} from "@/lib/accounting";
import { deleteOperationalJournal, postPurchaseJournal } from "@/lib/operational-journals";
import { adjustWarehouseStock, resolveOperationalLocation } from "@/lib/locations";

type PurchaseLineInput = {
  productId: string;
  quantity: number;
  price: number;
  discount?: number;
  tax?: number;
  description?: string;
};

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function makeDraftPurchaseReferenceNumber(referenceNumber: string): string {
  const value = String(referenceNumber || "").trim();
  if (!value) return value;
  if (/^DRAFT\//i.test(value) || /^DRAFT-/i.test(value)) return value;

  const parts = value.split("/");
  if (parts.length >= 4) {
    return ["DRAFT", ...parts.slice(1)].join("/");
  }

  return `DRAFT/${value}`;
}

function restorePurchaseReferenceNumber(
  referenceNumber: string,
  settings?: Parameters<typeof getPrefixForKind>[1],
): string | null {
  const value = String(referenceNumber || "").trim();
  if (!value) return null;

  if (/^DRAFT\//i.test(value)) {
    const parts = value.split("/");
    if (parts.length >= 4) {
      const prefix = getPrefixForKind("purchase_order", settings);
      return [prefix, ...parts.slice(1)].join("/");
    }
  }

  if (/^DRAFT\//i.test(value)) return value.replace(/^DRAFT/i, getPrefixForKind("purchase_order", settings));
  return null;
}

async function getProductsForPurchase(
  tx: any,
  companyId: string,
  items: PurchaseLineInput[],
): Promise<Map<string, any>> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, companyId, deletedAt: null },
  });

  if (products.length !== productIds.length) {
    throw new Error("One or more purchase products were not found");
  }

  return new Map<string, any>(products.map((product: any) => [product.id, product]));
}

async function recalculateSupplierTotalSales(tx: any, companyId: string, supplierId: string) {
  const [purchases, returns] = await Promise.all([
    tx.ledgerEntry.aggregate({
      where: { companyId, supplierId, type: "PURCHASE" },
      _sum: { debit: true },
    }),
    tx.ledgerEntry.aggregate({
      where: { companyId, supplierId, type: "RETURN" },
      _sum: { credit: true },
    }),
  ]);

  const total = Math.max(0, Number(purchases._sum.debit || 0) - Number(returns._sum.credit || 0));

  await tx.supplier.update({
    where: { id: supplierId },
    data: { totalSales: total },
  });
}

export async function getPurchases(params?: {
  search?: string;
  supplierId?: string;
  status?: string | string[];
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const canViewAll = await checkPermission(PERMISSIONS.PURCHASES_VIEW_ALL);

  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (!canViewAll) where.createdById = userId;

  if (params?.supplierId) where.supplierId = params.supplierId;
  if (Array.isArray(params?.status)) {
    where.status = { in: params.status };
  } else if (params?.status) {
    where.status = params.status;
  }
  if (params?.search) {
    where.OR = [{ referenceNumber: { contains: params.search, mode: "insensitive" } }];
  }

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where: where as any,
      include: {
        supplier: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchase.count({ where: where as any }),
  ]);

  return { data: purchases, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getPurchase(id: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const canViewAll = await checkPermission(PERMISSIONS.PURCHASES_VIEW_ALL);

  const where: Record<string, unknown> = { id, companyId, deletedAt: null };
  if (!canViewAll) where.createdById = userId;

  return prisma.purchase.findFirst({
    where: where as any,
    include: {
      supplier: true,
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      createdBy: { select: { name: true } },
    },
  });
}

export async function createPurchase(data: {
  supplierId?: string;
  items: PurchaseLineInput[];
  discount?: number;
  paymentMethod?: string;
  notes?: string;
  terms?: string;
  paid?: number;
  dueDate?: string | null;
  status?: string;
  branchId?: string;
  warehouseId?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
  });

  const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalDiscount =
    (data.discount ?? 0) + data.items.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  const totalTax = data.items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity - (item.discount ?? 0);
    return sum + (itemTotal * (item.tax || 0)) / 100;
  }, 0);
  const total = subtotal - totalDiscount + totalTax;
  const paid = data.status === "DRAFT" ? 0 : Math.max(0, data.paid ?? 0);
  const due = Math.max(0, total - paid);
  const paymentStatus = computePaymentStatus(total, paid);
  let refNumber = "";

  const purchase = await prisma.$transaction(async (tx) => {
    refNumber = await reserveNextDocumentNumber(tx, companyId, "purchase_order", settings);
    if (data.status === "DRAFT") {
      refNumber = makeDraftPurchaseReferenceNumber(refNumber);
    }

    const productsById = await getProductsForPurchase(tx, companyId, data.items);
    const location = await resolveOperationalLocation(tx, {
      companyId,
      userId,
      branchId: data.branchId,
      warehouseId: data.warehouseId,
    });

    const purchase = await tx.purchase.create({
      data: {
        referenceNumber: refNumber,
        subtotal,
        discount: totalDiscount,
        tax: totalTax,
        total,
        paid,
        due,
        paymentStatus,
        status: (data.status || "RECEIVED") as any,
        paymentMethod: (data.paymentMethod || "CASH") as any,
        notes: data.notes,
        terms: data.terms,
        dueDate: parseOptionalDate(data.dueDate),
        supplierId: data.supplierId || null,
        companyId,
        branchId: location.branchId,
        warehouseId: location.warehouseId,
        createdById: userId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount ?? 0,
            tax: item.tax || 0,
            subtotal: item.price * item.quantity - (item.discount ?? 0),
            description: item.description || null,
          })),
        },
      },
      include: { items: true, supplier: true },
    });

    if (data.status !== "DRAFT") {
      for (const item of data.items) {
        const product = productsById.get(item.productId);
        if (product) {
          const { beforeStock, afterStock } = await adjustWarehouseStock(tx, {
            companyId,
            productId: item.productId,
            warehouseId: location.warehouseId,
            quantityDelta: item.quantity,
          });
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              companyId,
              branchId: location.branchId,
              warehouseId: location.warehouseId,
              type: "PURCHASE",
              quantity: item.quantity,
              beforeStock,
              afterStock,
              reference: refNumber,
              createdById: userId,
            },
          });
        }
      }
    }

    if (paid > 0 && data.supplierId) {
      await createLedgerEntry(
        {
          companyId,
          supplierId: data.supplierId,
          type: "PAYMENT",
          referenceId: purchase.id,
          referenceNumber: refNumber,
          debit: 0,
          credit: paid,
          description: `Payment made for purchase ${refNumber}`,
          createdById: userId,
        },
        tx,
      );
    }

    if (data.supplierId && data.status !== "DRAFT") {
      await createLedgerEntry(
        {
          companyId,
          supplierId: data.supplierId,
          type: "PURCHASE",
          referenceId: purchase.id,
          referenceNumber: refNumber,
          debit: total,
          credit: 0,
          description: `Purchase ${refNumber} created`,
          createdById: userId,
        },
        tx,
      );
      await recalculateSupplierTotalSales(tx, companyId, data.supplierId);
    }

    if (data.status !== "DRAFT") {
      await postPurchaseJournal(tx, {
        companyId,
        userId,
        purchaseId: purchase.id,
        referenceNumber: refNumber,
        supplierId: data.supplierId || null,
        total,
        tax: totalTax,
        paid,
        paymentMethod: data.paymentMethod || "CASH",
        date: new Date(),
      });
    }

    return purchase;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Purchase",
    entityId: purchase.id,
    metadata: {
      referenceNumber: refNumber,
      total,
      paid,
      due,
      paymentStatus,
      status: data.status || "RECEIVED",
    },
  });

  await createNotification({
    companyId,
    userId,
    title: "Purchase Order Created",
    message: `Purchase order ${refNumber} created — Rs ${total} total`,
    type: "SUCCESS",
  });
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Purchase Order Created",
    body: `PO ${refNumber} — Rs ${total} from ${purchase.supplier?.name || "Unknown"} — by ${user.name || userId}`,
    url: `/purchases/${purchase.id}`,
  });

  if (due > 0 && data.status !== "DRAFT") {
    await createNotification({
      companyId,
      userId,
      title: "Pending Payment",
      message: `Purchase ${refNumber} has pending payment of ${due}`,
      type: "WARNING",
    });
    await sendPushNotificationWithAdmins(companyId, userId, {
      title: "Pending Payment",
      body: `Purchase ${refNumber} from ${purchase.supplier?.name || "Unknown"} — Rs ${total} total, Rs ${due} due — by ${user.name || userId}`,
      url: `/purchases/${purchase.id}`,
    });
  }

  revalidatePath("/purchases");
  return purchase;
}

export async function updatePurchase(
  id: string,
  data: {
    supplierId?: string;
    items?: PurchaseLineInput[];
    discount?: number;
    paymentMethod?: string;
    notes?: string;
    terms?: string;
    paid?: number;
    dueDate?: string | null;
    status?: string;
  },
) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.purchase.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { items: true },
  });
  if (!existing) throw new Error("Purchase not found");

  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
  });

  const newStatus = data.status || existing.status;
  const isPromotingFromDraft =
    newStatus !== "DRAFT" &&
    (existing.status === "DRAFT" || /^DRAFT\//i.test(existing.referenceNumber));
  const existingAffectsStock = existing.status !== "DRAFT";
  const updatedAffectsStock = newStatus !== "DRAFT";
  let referenceNumber = existing.referenceNumber;

  const purchase = await prisma.$transaction(async (tx) => {
    if (isPromotingFromDraft) {
      const restored = restorePurchaseReferenceNumber(existing.referenceNumber, settings);
      if (restored) {
        const duplicate = await tx.purchase.findFirst({
          where: { companyId, deletedAt: null, referenceNumber: restored, id: { not: id } },
          select: { id: true },
        });
        if (duplicate) {
          throw new Error(`Cannot restore original PO number ${restored} because it is already used by another purchase.`);
        }
      }
      referenceNumber = restored ?? (await reserveNextDocumentNumber(tx, companyId, "purchase_order", settings));
    } else if (existing.status !== "DRAFT" && newStatus === "DRAFT") {
      referenceNumber = makeDraftPurchaseReferenceNumber(existing.referenceNumber);
    } else if (isLegacyDraftDocumentNumber(existing.referenceNumber) && newStatus !== "DRAFT") {
      referenceNumber = await reserveNextDocumentNumber(tx, companyId, "purchase_order", settings);
    }

    if (data.items) {
      const productsById = await getProductsForPurchase(tx, companyId, data.items);
      if (existingAffectsStock) {
        for (const oldItem of existing.items) {
          const product = await tx.product.findFirst({
            where: { id: oldItem.productId, companyId, deletedAt: null },
          });
          if (product) {
            await adjustWarehouseStock(tx, {
              companyId,
              productId: oldItem.productId,
              warehouseId: existing.warehouseId,
              quantityDelta: -Number(oldItem.quantity),
            });
          }
        }
      }
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

      const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
      const totalDiscount =
        (data.discount ?? Number(existing.discount)) +
        data.items.reduce((s, i) => s + (i.discount ?? 0), 0);
      const totalTax = data.items.reduce(
        (s, i) => s + ((i.price * i.quantity - (i.discount ?? 0)) * (i.tax ?? 0)) / 100,
        0,
      );
      const total = subtotal - totalDiscount + totalTax;
      const paid = newStatus === "DRAFT" ? 0 : (data.paid ?? Number(existing.paid));
      const due = Math.max(0, total - paid);
      const paymentStatus = computePaymentStatus(total, paid);

      const updated = await tx.purchase.update({
        where: { id },
        data: {
          referenceNumber,
          subtotal,
          discount: totalDiscount,
          tax: totalTax,
          total,
          paid,
          due,
          paymentStatus,
          status: newStatus as any,
          paymentMethod: (data.paymentMethod || existing.paymentMethod) as any,
          notes: data.notes ?? existing.notes,
          terms: data.terms ?? existing.terms,
          dueDate: data.dueDate === undefined ? existing.dueDate : parseOptionalDate(data.dueDate),
          supplierId: data.supplierId ?? existing.supplierId,
          updatedById: userId,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount ?? 0,
              tax: item.tax || 0,
              subtotal: item.price * item.quantity - (item.discount ?? 0),
              description: item.description || null,
            })),
          },
        },
        include: { items: true, supplier: true },
      });

      if (updatedAffectsStock)
        for (const item of data.items) {
          const product = productsById.get(item.productId);
          if (product) {
            const { beforeStock, afterStock } = await adjustWarehouseStock(tx, {
              companyId,
              productId: item.productId,
              warehouseId: existing.warehouseId,
              quantityDelta: Number(item.quantity),
            });
            await tx.inventoryLog.create({
              data: {
                productId: item.productId,
                companyId,
                warehouseId: existing.warehouseId,
                type: "PURCHASE",
                quantity: item.quantity,
                beforeStock,
                afterStock,
                reference: referenceNumber,
                notes: "Purchase edit",
                createdById: userId,
              },
            });
          }
        }

      const effectiveSupplierId = data.supplierId ?? existing.supplierId;
      await tx.ledgerEntry.deleteMany({ where: { referenceId: id, companyId } });
      if (existing.supplierId && existing.supplierId !== effectiveSupplierId) {
        await recalculateLedgerBalances(tx, companyId, null, existing.supplierId);
      }
      if (paid > 0 && effectiveSupplierId) {
        await tx.ledgerEntry.create({
          data: {
            companyId,
            supplierId: effectiveSupplierId,
            type: "PAYMENT",
            referenceId: id,
            referenceNumber,
            debit: 0,
            credit: paid,
            balance: 0,
            entryDate: new Date(),
            description: `Payment made for purchase ${referenceNumber}`,
            createdById: userId,
          },
        });
      }
      if (effectiveSupplierId && newStatus !== "DRAFT") {
        await tx.ledgerEntry.create({
          data: {
            companyId,
            supplierId: effectiveSupplierId,
            type: "PURCHASE",
            referenceId: id,
            referenceNumber,
            debit: total,
            credit: 0,
            balance: 0,
            entryDate: new Date(),
            description: `Purchase ${referenceNumber} created`,
            createdById: userId,
          },
        });
      }
      if (effectiveSupplierId) {
        await recalculateLedgerBalances(tx, companyId, null, effectiveSupplierId);
        await recalculateSupplierTotalSales(tx, companyId, effectiveSupplierId);
      }

      await deleteOperationalJournal(tx, companyId, `PURCHASE:${id}`);
      if (newStatus !== "DRAFT") {
        const allocatedPaid = await tx.paymentAllocation.aggregate({
          where: { purchaseId: id },
          _sum: { allocatedAmount: true },
        });
        const journalPaid = Math.max(0, paid - Number(allocatedPaid._sum.allocatedAmount || 0));
        await postPurchaseJournal(tx, {
          companyId,
          userId,
          purchaseId: id,
          referenceNumber,
          supplierId: effectiveSupplierId,
          total,
          tax: totalTax,
          paid: journalPaid,
          paymentMethod: data.paymentMethod || existing.paymentMethod,
          date: new Date(),
        });
      }

      return updated;
    }

    const statusLineItems = existing.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.price),
      discount: Number(item.discount),
      tax: Number(item.tax),
    }));

    if (existingAffectsStock && !updatedAffectsStock) {
      for (const oldItem of existing.items) {
        const product = await tx.product.findFirst({
          where: { id: oldItem.productId, companyId, deletedAt: null },
        });
        if (product) {
          const { beforeStock, afterStock } = await adjustWarehouseStock(tx, {
            companyId,
            productId: oldItem.productId,
            warehouseId: existing.warehouseId,
            quantityDelta: -Number(oldItem.quantity),
          });
          await tx.inventoryLog.create({
            data: {
              productId: oldItem.productId,
              companyId,
              type: "ADJUSTMENT",
              quantity: -oldItem.quantity,
              beforeStock,
              afterStock,
              reference: referenceNumber,
              notes: "Purchase converted to draft",
              createdById: userId,
            },
          });
        }
      }
    }

    if (!existingAffectsStock && updatedAffectsStock) {
      const productsById = await getProductsForPurchase(tx, companyId, statusLineItems);
      for (const item of statusLineItems) {
        const product = productsById.get(item.productId);
        const { beforeStock, afterStock } = await adjustWarehouseStock(tx, {
          companyId,
          productId: item.productId,
          warehouseId: existing.warehouseId,
          quantityDelta: Number(item.quantity),
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            companyId,
            type: "PURCHASE",
            quantity: item.quantity,
            beforeStock,
            afterStock,
            reference: referenceNumber,
            notes: "Draft purchase finalized",
            createdById: userId,
          },
        });
      }
    }

    const paidVal = newStatus === "DRAFT" ? 0 : (data.paid ?? Number(existing.paid));
    const totalVal = Number(existing.total);
    const dueVal = Math.max(0, totalVal - paidVal);
    const paymentStatus = computePaymentStatus(totalVal, paidVal);

    const updated = await tx.purchase.update({
      where: { id },
      data: {
        referenceNumber,
        discount: data.discount ?? existing.discount,
        paymentMethod: (data.paymentMethod || existing.paymentMethod) as any,
        notes: data.notes ?? existing.notes,
        terms: data.terms ?? existing.terms,
        paid: paidVal,
        due: dueVal,
        paymentStatus,
        status: newStatus as any,
        supplierId: data.supplierId ?? existing.supplierId,
        dueDate: data.dueDate === undefined ? existing.dueDate : parseOptionalDate(data.dueDate),
        updatedById: userId,
      },
      include: { items: true, supplier: true },
    });

    const effectiveSupplierId = data.supplierId ?? existing.supplierId;
    await tx.ledgerEntry.deleteMany({ where: { referenceId: id, companyId } });
    if (existing.supplierId && existing.supplierId !== effectiveSupplierId) {
      await recalculateLedgerBalances(tx, companyId, null, existing.supplierId);
    }
    if (paidVal > 0 && effectiveSupplierId) {
      await tx.ledgerEntry.create({
        data: {
          companyId,
          supplierId: effectiveSupplierId,
          type: "PAYMENT",
          referenceId: id,
          referenceNumber,
          debit: 0,
          credit: paidVal,
          balance: 0,
          entryDate: new Date(),
          description: `Payment made for purchase ${referenceNumber}`,
          createdById: userId,
        },
      });
    }
    if (effectiveSupplierId && newStatus !== "DRAFT") {
      await tx.ledgerEntry.create({
        data: {
          companyId,
          supplierId: effectiveSupplierId,
          type: "PURCHASE",
          referenceId: id,
          referenceNumber,
          debit: totalVal,
          credit: 0,
          balance: 0,
          entryDate: new Date(),
          description: `Purchase ${referenceNumber} created`,
          createdById: userId,
        },
      });
    }
    if (effectiveSupplierId) {
      await recalculateLedgerBalances(tx, companyId, null, effectiveSupplierId);
      await recalculateSupplierTotalSales(tx, companyId, effectiveSupplierId);
    }
    if (existing.supplierId && existing.supplierId !== effectiveSupplierId) {
      await recalculateSupplierTotalSales(tx, companyId, existing.supplierId);
    }

    await deleteOperationalJournal(tx, companyId, `PURCHASE:${id}`);
    if (newStatus !== "DRAFT") {
      const allocatedPaid = await tx.paymentAllocation.aggregate({
        where: { purchaseId: id },
        _sum: { allocatedAmount: true },
      });
      const journalPaid = Math.max(0, paidVal - Number(allocatedPaid._sum.allocatedAmount || 0));
      await postPurchaseJournal(tx, {
        companyId,
        userId,
        purchaseId: id,
        referenceNumber,
        supplierId: effectiveSupplierId,
        total: totalVal,
        tax: Number(existing.tax),
        paid: journalPaid,
        paymentMethod: data.paymentMethod || existing.paymentMethod,
        date: new Date(),
      });
    }

    return updated;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Purchase",
    entityId: id,
    metadata: { referenceNumber, updatedFields: Object.keys(data) },
  });

  revalidatePath("/purchases");
  return purchase;
}

export async function returnPurchase(id: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const purchase = await prisma.purchase.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { items: true, supplier: true },
  });
  if (!purchase) throw new Error("Purchase not found");
  if (purchase.status === "CANCELLED") throw new Error("Purchase is already cancelled");

  const returnAmount = Number(purchase.total);
  const settings = await prisma.companySettings.findUnique({ where: { companyId } });

  await prisma.$transaction(async (tx) => {
    for (const item of purchase.items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, companyId, deletedAt: null },
      });
      if (product) {
        const { beforeStock, afterStock } = await adjustWarehouseStock(tx, {
          companyId,
          productId: item.productId,
          warehouseId: purchase.warehouseId,
          quantityDelta: -Number(item.quantity),
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            companyId,
            warehouseId: purchase.warehouseId,
            type: "RETURN",
            quantity: -item.quantity,
            beforeStock,
            afterStock,
            reference: purchase.referenceNumber,
            notes: "Purchase return",
            createdById: userId,
          },
        });
      }
    }

    await tx.purchase.update({
      where: { id },
      data: {
        status: "CANCELLED",
        paymentStatus: "RETURNED",
        paid: 0,
        due: 0,
        updatedById: userId,
      },
    });

    if (purchase.supplierId) {
      await tx.ledgerEntry.create({
        data: {
          companyId,
          supplierId: purchase.supplierId,
          type: "RETURN",
          referenceId: id,
          referenceNumber: purchase.referenceNumber,
          debit: 0,
          credit: returnAmount,
          balance: 0,
          entryDate: new Date(),
          description: `Return of purchase ${purchase.referenceNumber}`,
          createdById: userId,
        },
      });
      await recalculateLedgerBalances(tx, companyId, null, purchase.supplierId);
      await recalculateSupplierTotalSales(tx, companyId, purchase.supplierId);
    }
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Purchase",
    entityId: id,
    metadata: { referenceNumber: purchase.referenceNumber, type: "return", returnAmount },
  });

  revalidatePath("/purchases");
}

export async function convertPurchaseToDraft(id: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const purchase = await prisma.purchase.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true, referenceNumber: true },
  });
  if (!purchase) throw new Error("Purchase not found");
  if (purchase.status === "DRAFT") return purchase;
  if (["CANCELLED", "RETURNED"].includes(purchase.status)) {
    throw new Error("Cancelled or returned purchases cannot be converted to draft");
  }

  const updated = await updatePurchase(id, { status: "DRAFT" });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Purchase",
    entityId: id,
    metadata: {
      referenceNumber: updated.referenceNumber,
      originalReferenceNumber: purchase.referenceNumber,
      type: "convert-to-draft",
    },
  });

  revalidatePath("/purchases");
  return updated;
}

export async function getSuppliers(search?: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const where: Record<string, unknown> = { companyId, isActive: true, deletedAt: null };
  if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }];
  return prisma.supplier.findMany({ where: where as any, orderBy: { name: "asc" }, take: 50 });
}

export async function createSupplier(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  taxId?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const supplier = await prisma.supplier.create({ data: { ...data, companyId } });
  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Supplier",
    entityId: supplier.id,
    metadata: { name: supplier.name },
  });
  await createNotification({
    companyId,
    userId,
    title: "Supplier Created",
    message: `Supplier ${supplier.name} created`,
    type: "SUCCESS",
  });
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Supplier Created",
    body: `Supplier ${supplier.name} created by ${user.name || userId}`,
    url: "/purchases/suppliers",
  });
  return supplier;
}
