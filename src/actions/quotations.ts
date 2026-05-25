"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";
import { createAuditLog } from "@/lib/audit";
import { createSale } from "@/actions/sales";
import { reserveNextDocumentNumber } from "@/lib/document-numbers";

type QuotationLineInput = {
  productId: string;
  quantity: number;
  price: number;
  discount?: number;
  tax?: number;
};

async function assertQuotationProducts(companyId: string, items: QuotationLineInput[]) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const count = await prisma.product.count({
    where: { id: { in: productIds }, companyId, deletedAt: null },
  });
  if (count !== productIds.length) {
    throw new Error("One or more quotation products were not found");
  }
}

function calculateQuotationTotals(items: QuotationLineInput[], discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const lineDiscount = items.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  const totalDiscount = discount + lineDiscount;
  const tax = items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity - (item.discount ?? 0);
    return sum + (itemTotal * (item.tax ?? 0)) / 100;
  }, 0);

  return {
    subtotal,
    discount: totalDiscount,
    tax,
    total: subtotal - totalDiscount + tax,
  };
}

export async function getQuotations(params?: {
  search?: string;
  customerId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const canViewAll = await checkPermission(PERMISSIONS.SALES_VIEW_ALL);

  const where: Record<string, unknown> = { companyId, deletedAt: null };
  if (!canViewAll) where.createdById = userId;

  if (params?.customerId) where.customerId = params.customerId;
  if (params?.status) where.status = params.status;
  if (params?.search) {
    where.OR = [{ quoteNumber: { contains: params.search, mode: "insensitive" } }];
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where: where as any,
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.quotation.count({ where: where as any }),
  ]);

  return {
    data: quotations.map((q) => ({
      ...q,
      subtotal: Number(q.subtotal),
      discount: Number(q.discount),
      tax: Number(q.tax),
      total: Number(q.total),
      items: q.items.map((i) => ({
        ...i,
        price: Number(i.price),
        discount: Number(i.discount),
        tax: Number(i.tax),
        subtotal: Number(i.subtotal),
      })),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getQuotation(id: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const canViewAll = await checkPermission(PERMISSIONS.SALES_VIEW_ALL);

  const where: Record<string, unknown> = { id, companyId, deletedAt: null };
  if (!canViewAll) where.createdById = userId;

  const quotation = await prisma.quotation.findFirst({
    where: where as any,
    include: {
      customer: true,
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true, sellingPrice: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
  });

  if (!quotation) throw new Error("Quotation not found");

  return {
    ...quotation,
    subtotal: Number(quotation.subtotal),
    discount: Number(quotation.discount),
    tax: Number(quotation.tax),
    total: Number(quotation.total),
    items: quotation.items.map((i) => ({
      ...i,
      price: Number(i.price),
      discount: Number(i.discount),
      tax: Number(i.tax),
      subtotal: Number(i.subtotal),
    })),
  };
}

export async function createQuotation(data: {
  customerId?: string;
  items: QuotationLineInput[];
  discount?: number;
  notes?: string;
  terms?: string;
  validUntil?: string;
  status?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  await assertQuotationProducts(companyId, data.items);
  const totals = calculateQuotationTotals(data.items, data.discount ?? 0);

  const settings = await prisma.companySettings.findUnique({ where: { companyId } });

  const quotation = await prisma.$transaction(async (tx) => {
    const quoteNumber = await reserveNextDocumentNumber(tx, companyId, "quotation", settings);

    return tx.quotation.create({
      data: {
        quoteNumber,
        customerId: data.customerId || null,
        companyId,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        status: (data.status as any) || "DRAFT",
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        notes: data.notes,
        terms: data.terms,
        createdById: userId,
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            discount: i.discount || 0,
            tax: i.tax || 0,
            subtotal: i.price * i.quantity - (i.discount || 0),
          })),
        },
      },
      include: {
        customer: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Quotation",
    entityId: quotation.id,
    metadata: { quoteNumber: quotation.quoteNumber },
  });

  revalidatePath("/quotations");
  return quotation;
}

export async function updateQuotation(
  id: string,
  data: {
    customerId?: string;
    items?: QuotationLineInput[];
    discount?: number;
    notes?: string;
    terms?: string;
    validUntil?: string;
    status?: string;
  },
) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.quotation.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { items: true },
  });
  if (!existing) throw new Error("Quotation not found");

  let subtotal = Number(existing.subtotal);
  let tax = Number(existing.tax);
  let total = Number(existing.total);
  let discount = Number(existing.discount);

  if (data.items) {
    await assertQuotationProducts(companyId, data.items);
    const totals = calculateQuotationTotals(data.items, data.discount ?? 0);
    subtotal = totals.subtotal;
    discount = totals.discount;
    tax = totals.tax;
    total = totals.total;

    await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
    await prisma.quotationItem.createMany({
      data: data.items.map((i) => ({
        quotationId: id,
        productId: i.productId,
        quantity: i.quantity,
        price: i.price,
        discount: i.discount || 0,
        tax: i.tax || 0,
        subtotal: i.price * i.quantity - (i.discount || 0),
      })),
    });
  } else if (data.discount !== undefined) {
    const totals = calculateQuotationTotals(
      existing.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: Number(item.price),
        discount: Number(item.discount),
        tax: Number(item.tax),
      })),
      data.discount,
    );
    subtotal = totals.subtotal;
    discount = totals.discount;
    tax = totals.tax;
    total = totals.total;
  }

  const quotation = await prisma.quotation.update({
    where: { id },
    data: {
      customerId: data.customerId !== undefined ? data.customerId : existing.customerId,
      subtotal,
      discount,
      tax,
      total,
      status: data.status as any,
      validUntil: data.validUntil ? new Date(data.validUntil) : existing.validUntil,
      notes: data.notes,
      terms: data.terms,
      updatedById: userId,
    },
    include: {
      customer: { select: { name: true } },
      items: { include: { product: { select: { name: true, sku: true } } } },
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Quotation",
    entityId: id,
    metadata: { quoteNumber: quotation.quoteNumber },
  });

  revalidatePath("/quotations");
  return quotation;
}

export async function updateQuotationStatus(id: string, status: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const quotation = await prisma.quotation.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!quotation) throw new Error("Quotation not found");

  const updated = await prisma.quotation.update({
    where: { id },
    data: { status: status as any, updatedById: userId },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Quotation",
    entityId: id,
    metadata: { status, quoteNumber: quotation.quoteNumber },
  });

  revalidatePath("/quotations");
  return updated;
}

export async function convertQuotationToSale(id: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const quotation = await prisma.quotation.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { items: true },
  });
  if (!quotation) throw new Error("Quotation not found");
  if (quotation.saleId) throw new Error("Quotation is already converted to a sales order");

  const convertibleStatuses = new Set(["DRAFT", "SENT", "ACCEPTED"]);
  if (!convertibleStatuses.has(quotation.status)) {
    throw new Error("Only active quotations can be converted to a sales order");
  }

  const lineDiscount = quotation.items.reduce((sum, item) => sum + Number(item.discount), 0);
  const headerDiscount = Math.max(0, Number(quotation.discount) - lineDiscount);

  const sale = await createSale({
    customerId: quotation.customerId || undefined,
    items: quotation.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.price),
      discount: Number(item.discount),
      tax: Number(item.tax),
    })),
    discount: headerDiscount,
    paid: 0,
    status: "CONFIRMED",
    terms: quotation.terms || undefined,
    dueDate: quotation.validUntil ? quotation.validUntil.toISOString().slice(0, 10) : null,
    notes: `From quotation: ${quotation.quoteNumber}\n${quotation.notes || ""}`,
  });

  await prisma.quotation.update({
    where: { id },
    data: { status: "CONVERTED_TO_SALE", saleId: sale.id, updatedById: userId },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Quotation",
    entityId: id,
    metadata: { convertedToSale: sale.id, invoiceNumber: sale.invoiceNumber },
  });

  revalidatePath("/quotations");
  revalidatePath("/sales");
  revalidatePath("/sales/new");
  return sale;
}

export async function deleteQuotation(id: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.quotation.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!existing) throw new Error("Quotation not found");

  await prisma.quotation.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "DELETE",
    entity: "Quotation",
    entityId: id,
    metadata: { quoteNumber: existing.quoteNumber },
  });

  revalidatePath("/quotations");
}

export async function getCustomers(search?: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  return prisma.customer.findMany({
    where: {
      companyId,
      isActive: true,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
    take: 50,
  });
}
