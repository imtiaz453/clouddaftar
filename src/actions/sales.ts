"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, checkPermission, requireTaxSetup } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";
import {
  documentKindForSaleStatus,
  isLegacyDraftDocumentNumber,
  reserveNextDocumentNumber,
} from "@/lib/document-numbers";
import { createAuditLog, createNotification } from "@/lib/audit";
import {
  computePaymentStatus,
  createLedgerEntry,
  recalculateLedgerBalances,
} from "@/lib/accounting";
import { deleteOperationalJournal, postSaleJournal } from "@/lib/operational-journals";
import { buildFbrQrPayload, formatFbrDate, formatFbrTime } from "@/lib/tax/fbr-qr";
import {
  buildZatcaPhase1Payload,
  formatZatcaTimestamp,
  formatZatcaTotal,
} from "@/lib/tax/zatca-qr";
import { writeZatcaInvoiceXml } from "@/lib/tax/zatca-phase2";
import { processZatcaInvoice } from "@/lib/zatca/zatca-service";
import {
  adjustWarehouseStock,
  getProductStockAtWarehouse,
  resolveOperationalLocation,
} from "@/lib/locations";

type SaleLineInput = {
  productId: string;
  quantity: number;
  price: number;
  discount?: number;
  tax?: number;
};

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isEnabled(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === "yes";
}

const POSTING_SALE_STATUSES = new Set(["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"]);

function salePostsToAccounting(status?: string | null): boolean {
  return POSTING_SALE_STATUSES.has(status || "COMPLETED");
}

function saleDocumentLabel(status?: string | null): string {
  if (status === "PROFORMA") return "proforma invoice";
  if (status === "DRAFT" || status === "CONFIRMED") return "sales order";
  return "invoice";
}

function computeSalePaymentFields(status: string, total: number, requestedPaid?: number | null) {
  const paid = salePostsToAccounting(status) ? Math.max(0, requestedPaid ?? 0) : 0;
  return {
    paid,
    due: Math.max(0, total - paid),
    paymentStatus: computePaymentStatus(total, paid),
  };
}

function buildZatcaSaleLines(sale: any) {
  return sale.items.map((item: any, index: number) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price || 0);
    const discount = Number(item.discount || 0);
    const lineTotal = unitPrice * quantity - discount;
    const taxRate = Number(item.tax || 0);

    return {
      id: String(index + 1),
      name: item.product?.name || `Item ${index + 1}`,
      quantity,
      unitPrice,
      discount,
      taxRate,
      lineTotal,
      taxAmount: (lineTotal * taxRate) / 100,
    };
  });
}

async function getProductsForSale(
  tx: any,
  companyId: string,
  items: SaleLineInput[],
): Promise<Map<string, any>> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, companyId, deletedAt: null },
  });

  if (products.length !== productIds.length) {
    throw new Error("One or more sale products were not found");
  }

  return new Map<string, any>(products.map((product: any) => [product.id, product]));
}

function assertSaleStockAvailable(
  productsById: Map<string, any>,
  items: SaleLineInput[],
  allowNegativeStock: boolean,
) {
  if (allowNegativeStock) return;

  const required = new Map<string, number>();
  for (const item of items) {
    required.set(item.productId, (required.get(item.productId) || 0) + item.quantity);
  }

  for (const [productId, quantity] of required) {
    const product = productsById.get(productId);
    if (!product?.isService && product.stock < quantity) {
      throw new Error(
        `Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${quantity}`,
      );
    }
  }
}

function calculateSaleCost(productsById: Map<string, any>, items: SaleLineInput[]) {
  return items.reduce((sum, item) => {
    const product = productsById.get(item.productId);
    if (!product || product.isService) return sum;
    return sum + Number(product.purchasePrice || 0) * item.quantity;
  }, 0);
}

async function recalculateCustomerTotalPurchases(tx: any, companyId: string, customerId: string) {
  const [invoices, returns] = await Promise.all([
    tx.ledgerEntry.aggregate({
      where: { companyId, customerId, type: "INVOICE" },
      _sum: { debit: true },
    }),
    tx.ledgerEntry.aggregate({
      where: { companyId, customerId, type: "RETURN" },
      _sum: { credit: true },
    }),
  ]);

  const total = Math.max(0, Number(invoices._sum.debit || 0) - Number(returns._sum.credit || 0));

  await tx.customer.update({
    where: { id: customerId },
    data: { totalPurchases: total },
  });
}

async function generateTaxComplianceForPostedSale(params: {
  companyId: string;
  userId: string;
  saleId: string;
  settings: any;
  taxComplianceMode?: string;
  buyerTaxNumber?: string;
}) {
  const { companyId, userId, saleId, settings } = params;
  const taxComplianceMode = params.taxComplianceMode || settings?.taxComplianceMode || "NONE";
  if (taxComplianceMode === "NONE") return;

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      company: true,
      customer: true,
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!sale) return;
  if (!salePostsToAccounting(sale.status)) return;

  const company = sale.company;
  const customerName = sale.customer?.name || "Walk-in Customer";
  const zatcaSettings = (settings?.zatcaSettings as Record<string, string> | null) || {};
  const zatcaConfig =
    taxComplianceMode === "ZATCA"
      ? await prisma.zatcaSetting.findUnique({ where: { companyId } })
      : null;
  const sellerTaxNumber =
    taxComplianceMode === "ZATCA"
      ? zatcaConfig?.sellerVatNumber || zatcaSettings.vatRegNo || company?.taxId || ""
      : company?.taxId || "";
  const sellerName =
    taxComplianceMode === "ZATCA"
      ? zatcaConfig?.sellerName || zatcaSettings.sellerName || company?.name || ""
      : company?.name || "";
  const buyerTaxNumber = params.buyerTaxNumber || sale.buyerTaxNumber || "";
  const issuedAt = new Date();
  const subtotal = Number(sale.subtotal || 0);
  const totalDiscount = Number(sale.discount || 0);
  const totalTax = Number(sale.tax || 0);
  const total = Number(sale.total || 0);

  let fbrQrPayload: string | undefined;
  let zatcaQrPayload: string | undefined;
  let zatcaInvoiceHash: string | undefined;
  let zatcaSubmissionStatus: string | undefined;
  let zatcaUuid: string | undefined;
  let zatcaXmlPath: string | undefined;
  let zatcaResponseJson: unknown;
  let taxComplianceStatus = "NOT_VERIFIED";

  if (taxComplianceMode === "FBR") {
    fbrQrPayload = buildFbrQrPayload({
      supplierName: sellerName,
      supplierNtn: sellerTaxNumber,
      buyerName: customerName,
      buyerNtn: buyerTaxNumber,
      invoiceNumber: sale.invoiceNumber,
      invoiceDate: formatFbrDate(issuedAt),
      invoiceTime: formatFbrTime(issuedAt),
      totalAmount: total.toFixed(2),
      salesTaxAmount: totalTax.toFixed(2),
      fbrInvoiceNumber: "",
    });
  } else if (taxComplianceMode === "ZATCA") {
    try {
      const result = await processZatcaInvoice({
        companyId,
        input: {
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          issuedAt,
          seller: {
            sellerName,
            sellerVatNumber: sellerTaxNumber,
            branchName: zatcaConfig?.branchName,
            crNumber: zatcaConfig?.crNumber || zatcaSettings.crNo,
            address: zatcaConfig?.address || zatcaSettings.address || company?.address,
          },
          buyer: {
            name: customerName,
            vatNumber: buyerTaxNumber || sale.customer?.taxId || undefined,
            address: sale.customer?.address || undefined,
          },
          totals: { subtotal, discount: totalDiscount, tax: totalTax, total },
          lines: buildZatcaSaleLines(sale),
        },
      });
      if (result) {
        zatcaQrPayload = result.qrPayload || undefined;
        zatcaInvoiceHash = result.invoiceHash;
        zatcaUuid = result.uuid;
        zatcaXmlPath = await writeZatcaInvoiceXml(companyId, sale.id, result.xml);
        zatcaSubmissionStatus = result.status;
        zatcaResponseJson = result.response;
        taxComplianceStatus =
          result.status === "REPORTED" ||
          result.status === "CLEARED" ||
          result.status === "LOCAL_STORED"
            ? "VERIFIED"
            : result.status === "FAILED"
              ? "FAILED"
              : "SIGNED";
      }
    } catch (error) {
      zatcaSubmissionStatus = "FAILED";
      zatcaResponseJson = {
        status: "FAILED",
        error: error instanceof Error ? error.message : "ZATCA processing failed",
      };
      taxComplianceStatus = "FAILED";
    }

    if (!zatcaQrPayload) {
      zatcaQrPayload = buildZatcaPhase1Payload(
        sellerName,
        sellerTaxNumber,
        formatZatcaTimestamp(issuedAt),
        formatZatcaTotal(total),
        formatZatcaTotal(totalTax),
      );
    }
  }

  await prisma.sale.update({
    where: { id: sale.id },
    data: {
      taxComplianceMode,
      taxComplianceStatus,
      fbrQrPayload,
      zatcaQrPayload,
      zatcaPhase:
        taxComplianceMode === "ZATCA"
          ? zatcaConfig?.mode === "LOCAL"
            ? "LOCAL"
            : zatcaSettings.phaseMode || "PHASE_1"
          : null,
      zatcaInvoiceHash,
      zatcaSubmissionStatus,
      zatcaUuid,
      zatcaXmlPath,
      zatcaResponseJson: zatcaResponseJson as any,
      sellerTaxNumber: sellerTaxNumber || null,
      buyerTaxNumber: buyerTaxNumber || null,
    },
  });

  const modeLabel = taxComplianceMode === "FBR" ? "FBR" : "ZATCA";
  await createNotification({
    companyId,
    userId,
    title: `${modeLabel} QR Generated`,
    message: `Invoice ${sale.invoiceNumber} - ${modeLabel} QR code generated`,
    type: "INFO",
  });
}

export async function getSales(params?: {
  search?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const canViewAll = await checkPermission(PERMISSIONS.SALES_VIEW_ALL);

  const where: Record<string, unknown> = {
    companyId,
    deletedAt: null,
  };
  if (!canViewAll) where.createdById = userId;

  if (params?.customerId) where.customerId = params.customerId;

  if (params?.search) {
    where.OR = [
      { invoiceNumber: { contains: params.search, mode: "insensitive" } },
      { customer: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where: where as any,
      include: {
        customer: { select: { name: true } },
        createdBy: { select: { name: true } },
        branch: { select: { name: true, code: true } },
        warehouse: { select: { name: true, code: true } },
        items: {
          include: { product: { select: { name: true, sku: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sale.count({ where: where as any }),
  ]);

  return {
    data: sales,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getSale(id: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const canViewAll = await checkPermission(PERMISSIONS.SALES_VIEW_ALL);

  const where: Record<string, unknown> = { id, companyId, deletedAt: null };
  if (!canViewAll) where.createdById = userId;

  return prisma.sale.findFirst({
    where: where as any,
    include: {
      customer: {
        select: { id: true, name: true, email: true, phone: true, address: true },
      },
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, barcode: true, unit: true, image: true },
          },
        },
      },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      branch: { select: { name: true, code: true } },
      warehouse: { select: { name: true, code: true } },
    },
  });
}

export async function createSale(data: {
  customerId?: string;
  items: SaleLineInput[];
  discount?: number;
  paymentMethod?: string;
  notes?: string;
  terms?: string;
  paid?: number;
  dueDate?: string | null;
  status?: string;
  branchId?: string;
  warehouseId?: string;
  taxComplianceMode?: string;
  buyerTaxNumber?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  await requireTaxSetup();

  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
  });

  const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalDiscount =
    (data.discount ?? 0) + data.items.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  const totalTax = data.items.reduce((sum, item) => {
    const itemDiscount = item.discount || 0;
    const itemTotal = item.price * item.quantity - itemDiscount;
    return sum + (itemTotal * (item.tax ?? 0)) / 100;
  }, 0);
  const total = subtotal - totalDiscount + totalTax;
  const status = data.status || "COMPLETED";
  const postsToAccounting = salePostsToAccounting(status);
  const { paid, due, paymentStatus } = computeSalePaymentFields(status, total, data.paid);
  let invoiceNumber = "";

  const sale = await prisma.$transaction(async (tx) => {
    invoiceNumber = await reserveNextDocumentNumber(
      tx,
      companyId,
      documentKindForSaleStatus(status),
      settings,
    );

    const productsById = await getProductsForSale(tx, companyId, data.items);
    const location = await resolveOperationalLocation(tx, {
      companyId,
      userId,
      branchId: data.branchId,
      warehouseId: data.warehouseId,
    });
    if (postsToAccounting) {
      if (!(settings?.enableNegativeStock ?? false)) {
        const required = new Map<string, number>();
        for (const item of data.items) {
          required.set(item.productId, (required.get(item.productId) || 0) + item.quantity);
        }

        for (const [productId, quantity] of required) {
          const product = productsById.get(productId);
          if (!product?.isService) {
            const available = await getProductStockAtWarehouse(
              tx,
              product,
              companyId,
              location.warehouseId,
            );
            if (available < quantity) {
              throw new Error(
                `Insufficient stock for ${product.name} at selected warehouse. Available: ${available}, requested: ${quantity}`,
              );
            }
          }
        }
      }
    }

    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        subtotal,
        discount: totalDiscount,
        tax: totalTax,
        total,
        paid,
        due,
        paymentStatus,
        status: status as any,
        paymentMethod: (data.paymentMethod || settings?.defaultPaymentMethod || "CASH") as any,
        notes: data.notes,
        terms: data.terms,
        dueDate: parseOptionalDate(data.dueDate),
        customerId: data.customerId || null,
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
            tax: item.tax ?? 0,
            subtotal: item.price * item.quantity - (item.discount ?? 0),
          })),
        },
      },
      include: { items: true, customer: true },
    });

    if (postsToAccounting) {
      for (const item of data.items) {
        const product = productsById.get(item.productId);
        if (product && !product.isService) {
          const { beforeStock, afterStock } = await adjustWarehouseStock(tx, {
            companyId,
            productId: item.productId,
            warehouseId: location.warehouseId,
            quantityDelta: -item.quantity,
          });
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              companyId,
              branchId: location.branchId,
              warehouseId: location.warehouseId,
              type: "SALE",
              quantity: -item.quantity,
              beforeStock,
              afterStock,
              reference: invoiceNumber,
              createdById: userId,
            },
          });
        }
      }
    }

    if (postsToAccounting && paid > 0 && data.customerId) {
      await createLedgerEntry(
        {
          companyId,
          customerId: data.customerId,
          type: "PAYMENT",
          referenceId: sale.id,
          referenceNumber: invoiceNumber,
          debit: 0,
          credit: paid,
          description: `Payment received for invoice ${invoiceNumber}`,
          createdById: userId,
        },
        tx,
      );
    }

    if (postsToAccounting && data.customerId) {
      await createLedgerEntry(
        {
          companyId,
          customerId: data.customerId,
          type: "INVOICE",
          referenceId: sale.id,
          referenceNumber: invoiceNumber,
          debit: total,
          credit: 0,
          description: `Invoice ${invoiceNumber} created`,
          createdById: userId,
        },
        tx,
      );
      await recalculateCustomerTotalPurchases(tx, companyId, data.customerId);
    }

    if (postsToAccounting) {
      await postSaleJournal(tx, {
        companyId,
        userId,
        saleId: sale.id,
        invoiceNumber,
        customerId: data.customerId || null,
        total,
        tax: totalTax,
        paid,
        paymentMethod: data.paymentMethod || settings?.defaultPaymentMethod || "CASH",
        costOfGoods: calculateSaleCost(productsById, data.items),
        date: new Date(),
      });
    }

    return sale;
  });

  const taxComplianceMode = data.taxComplianceMode || settings?.taxComplianceMode || "NONE";

  if (postsToAccounting && taxComplianceMode !== "NONE") {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    const customerName = sale.customer?.name || "Walk-in Customer";
    const zatcaSettings = (settings?.zatcaSettings as Record<string, string> | null) || {};
    const zatcaConfig =
      taxComplianceMode === "ZATCA"
        ? await prisma.zatcaSetting.findUnique({ where: { companyId } })
        : null;
    const sellerTaxNumber =
      taxComplianceMode === "ZATCA"
        ? zatcaConfig?.sellerVatNumber || zatcaSettings.vatRegNo || company?.taxId || ""
        : company?.taxId || "";
    const sellerName =
      taxComplianceMode === "ZATCA"
        ? zatcaConfig?.sellerName || zatcaSettings.sellerName || company?.name || ""
        : company?.name || "";
    let fbrQrPayload: string | undefined;
    let zatcaQrPayload: string | undefined;
    let zatcaInvoiceHash: string | undefined;
    let zatcaSubmissionStatus: string | undefined;
    let zatcaUuid: string | undefined;
    let zatcaXmlPath: string | undefined;
    let zatcaResponseJson: unknown;
    let taxComplianceStatus = "NOT_VERIFIED";
    const issuedAt = new Date();
    if (taxComplianceMode === "FBR") {
      const payload = buildFbrQrPayload({
        supplierName: sellerName,
        supplierNtn: sellerTaxNumber,
        buyerName: customerName,
        buyerNtn: data.buyerTaxNumber || "",
        invoiceNumber,
        invoiceDate: formatFbrDate(issuedAt),
        invoiceTime: formatFbrTime(issuedAt),
        totalAmount: total.toFixed(2),
        salesTaxAmount: totalTax.toFixed(2),
        fbrInvoiceNumber: "",
      });
      fbrQrPayload = payload;
    } else if (taxComplianceMode === "ZATCA") {
      try {
        const saleForZatca = await prisma.sale.findUnique({
          where: { id: sale.id },
          include: {
            customer: true,
            items: { include: { product: { select: { name: true } } } },
          },
        });
        const result = await processZatcaInvoice({
          companyId,
          input: {
            saleId: sale.id,
            invoiceNumber,
            issuedAt,
            seller: {
              sellerName,
              sellerVatNumber: sellerTaxNumber,
              branchName: zatcaConfig?.branchName,
              crNumber: zatcaConfig?.crNumber || zatcaSettings.crNo,
              address: zatcaConfig?.address || zatcaSettings.address || company?.address,
            },
            buyer: {
              name: saleForZatca?.customer?.name || customerName,
              vatNumber: data.buyerTaxNumber || saleForZatca?.customer?.taxId || undefined,
              address: saleForZatca?.customer?.address || undefined,
            },
            totals: { subtotal, discount: totalDiscount, tax: totalTax, total },
            lines: buildZatcaSaleLines(saleForZatca || sale),
          },
        });
        if (result) {
          zatcaQrPayload = result.qrPayload || undefined;
          zatcaInvoiceHash = result.invoiceHash;
          zatcaUuid = result.uuid;
          zatcaXmlPath = await writeZatcaInvoiceXml(companyId, sale.id, result.xml);
          zatcaSubmissionStatus = result.status;
          zatcaResponseJson = result.response;
          taxComplianceStatus =
            result.status === "REPORTED" ||
            result.status === "CLEARED" ||
            result.status === "LOCAL_STORED"
              ? "VERIFIED"
              : result.status === "FAILED"
                ? "FAILED"
                : "SIGNED";
        }
      } catch (error) {
        zatcaSubmissionStatus = "FAILED";
        zatcaResponseJson = {
          status: "FAILED",
          error: error instanceof Error ? error.message : "ZATCA processing failed",
        };
        taxComplianceStatus = "FAILED";
      }

      if (!zatcaQrPayload) {
        zatcaQrPayload = buildZatcaPhase1Payload(
          sellerName,
          sellerTaxNumber,
          formatZatcaTimestamp(issuedAt),
          formatZatcaTotal(total),
          formatZatcaTotal(totalTax),
        );
      }
    }
    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        taxComplianceMode,
        taxComplianceStatus,
        fbrQrPayload,
        zatcaQrPayload,
        zatcaPhase:
          taxComplianceMode === "ZATCA"
            ? zatcaConfig?.mode === "LOCAL"
              ? "LOCAL"
              : zatcaSettings.phaseMode || "PHASE_1"
            : null,
        zatcaInvoiceHash,
        zatcaSubmissionStatus,
        zatcaUuid,
        zatcaXmlPath,
        zatcaResponseJson: zatcaResponseJson as any,
        sellerTaxNumber: sellerTaxNumber || null,
        buyerTaxNumber: data.buyerTaxNumber || null,
      },
    });

    const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const modeLabel = taxComplianceMode === "FBR" ? "FBR" : "ZATCA";
    await createNotification({
      companyId,
      userId,
      title: `${modeLabel} QR Generated`,
      message: `Invoice ${invoiceNumber} - ${modeLabel} QR code generated at ${now}`,
      type: "INFO",
    });
  }

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Sale",
    entityId: sale.id,
    metadata: {
      invoiceNumber,
      total,
      paid,
      due,
      paymentStatus,
      status,
    },
  });

  if (postsToAccounting && due > 0) {
    await createNotification({
      companyId,
      userId,
      title: "Pending Payment",
      message: `Invoice ${invoiceNumber} has pending payment of ${due}`,
      type: "WARNING",
    });
  }

  revalidatePath("/sales");
  return sale;
}

export async function updateSale(
  id: string,
  data: {
    customerId?: string;
    items?: SaleLineInput[];
    discount?: number;
    paymentMethod?: string;
    notes?: string;
    terms?: string;
    paid?: number;
    dueDate?: string | null;
    status?: string;
    taxComplianceMode?: string;
    buyerTaxNumber?: string;
  },
) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.sale.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { items: true },
  });
  if (!existing) throw new Error("Sale not found");

  const settings = await prisma.companySettings.findUnique({ where: { companyId } });
  const newStatus = data.status || existing.status;
  const existingAffectsStock = salePostsToAccounting(existing.status);
  const updatedAffectsStock = salePostsToAccounting(newStatus);
  const existingKind = documentKindForSaleStatus(existing.status);
  const newKind = documentKindForSaleStatus(newStatus);
  const itemsInput =
    data.items ||
    existing.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.price),
      discount: Number(item.discount),
      tax: Number(item.tax),
    }));
  const existingLineDiscount = existing.items.reduce(
    (sum, item) => sum + Number(item.discount || 0),
    0,
  );
  const existingHeaderDiscount = Math.max(0, Number(existing.discount || 0) - existingLineDiscount);
  const headerDiscount = data.discount ?? existingHeaderDiscount;
  const subtotal = itemsInput.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const lineDiscount = itemsInput.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  const totalDiscount = headerDiscount + lineDiscount;
  const totalTax = itemsInput.reduce((sum, item) => {
    return sum + ((item.price * item.quantity - (item.discount ?? 0)) * (item.tax ?? 0)) / 100;
  }, 0);
  const total = subtotal - totalDiscount + totalTax;
  const { paid, due, paymentStatus } = computeSalePaymentFields(
    newStatus,
    total,
    data.paid ?? Number(existing.paid),
  );
  const effectiveCustomerId = data.customerId ?? existing.customerId;
  let invoiceNumber = existing.invoiceNumber;
  const needsDocumentNumber =
    (newStatus !== existing.status && existingKind !== newKind) ||
    (newStatus !== "DRAFT" && isLegacyDraftDocumentNumber(existing.invoiceNumber));

  const sale = await prisma.$transaction(async (tx) => {
    if (needsDocumentNumber) {
      invoiceNumber = await reserveNextDocumentNumber(tx, companyId, newKind, settings);
    }

    const stockNeedsRestore = existingAffectsStock && (Boolean(data.items) || !updatedAffectsStock);
    if (stockNeedsRestore) {
      for (const oldItem of existing.items) {
        const product = await tx.product.findFirst({
          where: { id: oldItem.productId, companyId, deletedAt: null },
        });
        if (product && !product.isService && existing.warehouseId) {
          const { beforeStock, afterStock } = await adjustWarehouseStock(tx, {
            companyId,
            productId: oldItem.productId,
            warehouseId: existing.warehouseId,
            quantityDelta: oldItem.quantity,
          });
          await tx.inventoryLog.create({
            data: {
              productId: oldItem.productId,
              companyId,
              branchId: existing.branchId,
              warehouseId: existing.warehouseId,
              type: "ADJUSTMENT",
              quantity: oldItem.quantity,
              beforeStock,
              afterStock,
              reference: invoiceNumber,
              notes: data.items
                ? "Invoice items edited"
                : "Invoice converted to non-posting document",
              createdById: userId,
            },
          });
        }
      }
    }

    const stockNeedsIssue = updatedAffectsStock && (Boolean(data.items) || !existingAffectsStock);
    const productsById = stockNeedsIssue
      ? await getProductsForSale(tx, companyId, itemsInput)
      : new Map<string, any>();

    if (stockNeedsIssue) {
      assertSaleStockAvailable(productsById, itemsInput, settings?.enableNegativeStock ?? false);
      for (const item of itemsInput) {
        const product = productsById.get(item.productId);
        if (!product || product.isService || !existing.warehouseId) continue;
        const { beforeStock, afterStock } = await adjustWarehouseStock(tx, {
          companyId,
          productId: item.productId,
          warehouseId: existing.warehouseId,
          quantityDelta: -item.quantity,
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            companyId,
            branchId: existing.branchId,
            warehouseId: existing.warehouseId,
            type: "SALE",
            quantity: -item.quantity,
            beforeStock,
            afterStock,
            reference: invoiceNumber,
            notes:
              existingAffectsStock && data.items
                ? "Invoice items edited"
                : `${saleDocumentLabel(existing.status)} converted to invoice`,
            createdById: userId,
          },
        });
      }
    }

    if (data.items) await tx.saleItem.deleteMany({ where: { saleId: id } });

    const updated = await tx.sale.update({
      where: { id },
      data: {
        subtotal,
        discount: totalDiscount,
        tax: totalTax,
        total,
        paymentMethod: (data.paymentMethod || existing.paymentMethod) as any,
        notes: data.notes ?? existing.notes,
        terms: data.terms ?? existing.terms,
        dueDate: data.dueDate === undefined ? existing.dueDate : parseOptionalDate(data.dueDate),
        paid,
        due,
        paymentStatus,
        invoiceNumber,
        status: newStatus as any,
        customerId: effectiveCustomerId,
        updatedById: userId,
        ...(!updatedAffectsStock
          ? {
              taxComplianceMode: "NONE",
              taxComplianceStatus: null,
              fbrQrPayload: null,
              fbrInvoiceNumber: null,
              zatcaQrPayload: null,
              zatcaPhase: null,
              zatcaInvoiceHash: null,
              zatcaSubmissionStatus: null,
              zatcaUuid: null,
              zatcaXmlPath: null,
              zatcaResponseJson: undefined,
              sellerTaxNumber: null,
              buyerTaxNumber: null,
            }
          : {}),
        ...(data.items
          ? {
              items: {
                create: itemsInput.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  price: item.price,
                  discount: item.discount ?? 0,
                  tax: item.tax ?? 0,
                  subtotal: item.price * item.quantity - (item.discount ?? 0),
                })),
              },
            }
          : {}),
      },
      include: { items: true, customer: true },
    });

    await tx.ledgerEntry.deleteMany({ where: { referenceId: id, companyId } });
    if (existing.customerId && existing.customerId !== effectiveCustomerId) {
      await recalculateLedgerBalances(tx, companyId, existing.customerId, null);
    }
    if (updatedAffectsStock && paid > 0 && effectiveCustomerId) {
      await tx.ledgerEntry.create({
        data: {
          companyId,
          customerId: effectiveCustomerId,
          type: "PAYMENT",
          referenceId: id,
          referenceNumber: invoiceNumber,
          debit: 0,
          credit: paid,
          balance: 0,
          entryDate: new Date(),
          description: `Payment received for invoice ${invoiceNumber}`,
          createdById: userId,
        },
      });
    }
    if (updatedAffectsStock && effectiveCustomerId) {
      await tx.ledgerEntry.create({
        data: {
          companyId,
          customerId: effectiveCustomerId,
          type: "INVOICE",
          referenceId: id,
          referenceNumber: invoiceNumber,
          debit: total,
          credit: 0,
          balance: 0,
          entryDate: new Date(),
          description: `Invoice ${invoiceNumber} created`,
          createdById: userId,
        },
      });
    }
    if (effectiveCustomerId) {
      await recalculateLedgerBalances(tx, companyId, effectiveCustomerId, null);
      await recalculateCustomerTotalPurchases(tx, companyId, effectiveCustomerId);
    }
    if (existing.customerId && existing.customerId !== effectiveCustomerId) {
      await recalculateCustomerTotalPurchases(tx, companyId, existing.customerId);
    }

    await deleteOperationalJournal(tx, companyId, `SALE:${id}`);
    if (updatedAffectsStock) {
      const allocatedPaid = await tx.paymentAllocation.aggregate({
        where: { saleId: id },
        _sum: { allocatedAmount: true },
      });
      const journalPaid = Math.max(0, paid - Number(allocatedPaid._sum.allocatedAmount || 0));
      const journalProducts =
        productsById.size > 0
          ? productsById
          : new Map(
              (
                await tx.product.findMany({
                  where: { id: { in: itemsInput.map((item) => item.productId) }, companyId },
                })
              ).map((product: any) => [product.id, product]),
            );
      await postSaleJournal(tx, {
        companyId,
        userId,
        saleId: id,
        invoiceNumber,
        customerId: effectiveCustomerId,
        total,
        tax: totalTax,
        paid: journalPaid,
        paymentMethod: data.paymentMethod || existing.paymentMethod,
        costOfGoods: calculateSaleCost(journalProducts, itemsInput),
        date: new Date(),
      });
    }

    return updated;
  });

  if (!existingAffectsStock && updatedAffectsStock) {
    await generateTaxComplianceForPostedSale({
      companyId,
      userId,
      saleId: id,
      settings,
      taxComplianceMode: data.taxComplianceMode,
      buyerTaxNumber: data.buyerTaxNumber,
    });
  }

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Sale",
    entityId: id,
    metadata: { invoiceNumber, status: newStatus, updatedFields: Object.keys(data) },
  });

  revalidatePath("/sales");
  return sale;
}

export async function refundSale(
  id: string,
  refundItems?: { productId: string; quantity: number }[],
) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const sale = await prisma.sale.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { items: true, customer: true },
  });
  if (!sale) throw new Error("Sale not found");
  if (!salePostsToAccounting(sale.status)) {
    throw new Error("Only posted invoices can be refunded");
  }
  if (sale.status === "REFUNDED") throw new Error("Sale is already refunded");
  if (sale.status === "CANCELLED") throw new Error("Sale is cancelled");

  const itemsToRefund = refundItems || sale.items;
  for (const item of itemsToRefund) {
    const saleItem = sale.items.find((si) => si.productId === item.productId);
    if (!saleItem) throw new Error("Refund item does not belong to this sale");
    if (item.quantity <= 0 || item.quantity > saleItem.quantity) {
      throw new Error(`Invalid refund quantity for ${saleItem.productId}`);
    }
  }

  const refund = await prisma.$transaction(async (tx) => {
    for (const item of itemsToRefund) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, companyId, deletedAt: null },
      });
      if (product) {
        const beforeStock = product.stock;
        const afterStock = beforeStock + item.quantity;
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            companyId,
            type: "RETURN",
            quantity: item.quantity,
            beforeStock,
            afterStock,
            reference: sale.invoiceNumber,
            notes: "Sale refund",
            createdById: userId,
          },
        });
      }
    }

    const isFullRefund = itemsToRefund.length === sale.items.length;
    const refundAmount = itemsToRefund.reduce((sum, item) => {
      const saleItem = sale.items.find((si) => si.productId === item.productId);
      return sum + Number(saleItem ? Number(saleItem.subtotal) : 0);
    }, 0);

    const newPaid = Math.max(0, Number(sale.paid) - refundAmount);
    const newDue = Number(sale.total) - newPaid;
    const paymentStatus = computePaymentStatus(Number(sale.total), newPaid);

    const updated = await tx.sale.update({
      where: { id },
      data: {
        status: (isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED") as any,
        paid: newPaid,
        due: newDue,
        paymentStatus,
        updatedById: userId,
      },
      include: { items: true, customer: true },
    });

    if (sale.customerId) {
      await tx.ledgerEntry.create({
        data: {
          companyId,
          customerId: sale.customerId,
          type: "RETURN",
          referenceId: id,
          referenceNumber: sale.invoiceNumber,
          debit: 0,
          credit: refundAmount,
          balance: 0,
          entryDate: new Date(),
          description: `Refund for invoice ${sale.invoiceNumber}`,
          createdById: userId,
        },
      });
      await recalculateLedgerBalances(tx, companyId, sale.customerId, null);
      await recalculateCustomerTotalPurchases(tx, companyId, sale.customerId);
    }

    return updated;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Sale",
    entityId: id,
    metadata: { invoiceNumber: sale.invoiceNumber, type: "refund", refundAmount: refund },
  });

  revalidatePath("/sales");
  return refund;
}

export async function convertSaleToDraft(id: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const sale = await prisma.sale.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!sale) throw new Error("Sale not found");
  if (!["DRAFT", "CONFIRMED", "PROFORMA", "COMPLETED"].includes(sale.status)) {
    throw new Error(
      "Only draft, sales order, proforma, or completed invoice can be converted to draft",
    );
  }

  return updateSale(id, { status: "DRAFT" });
}

export async function convertSaleDocument(id: string, target: "PROFORMA" | "COMPLETED") {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const sale = await prisma.sale.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!sale) throw new Error("Sale not found");
  if (sale.status === target) return sale;
  if (["PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"].includes(sale.status)) {
    throw new Error("Refunded or cancelled documents cannot be converted");
  }

  if (target === "PROFORMA" && !["DRAFT", "CONFIRMED"].includes(sale.status)) {
    throw new Error("Only sales orders can be converted to proforma invoice");
  }

  if (target === "COMPLETED" && !["DRAFT", "CONFIRMED", "PROFORMA"].includes(sale.status)) {
    throw new Error("Only sales orders or proforma invoices can be converted to invoice");
  }

  return updateSale(id, { status: target });
}

export async function getCustomers(search?: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const where: Record<string, unknown> = { companyId, isActive: true, deletedAt: null };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.customer.findMany({
    where: where as any,
    orderBy: { name: "asc" },
    take: 50,
  });
}

export async function getCustomer(id: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  return prisma.customer.findFirst({
    where: { id, companyId, deletedAt: null },
  });
}

export async function createCustomer(data: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  taxId?: string;
  creditLimit?: number;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const customer = await prisma.customer.create({ data: { ...data, companyId } });
  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Customer",
    entityId: customer.id,
    metadata: { name: customer.name },
  });
  return customer;
}

export async function updateCustomer(
  id: string,
  data: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    taxId?: string;
    creditLimit?: number;
  },
) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.customer.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!existing) throw new Error("Customer not found");

  const customer = await prisma.customer.update({
    where: { id },
    data,
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Customer",
    entityId: id,
    metadata: { name: customer.name, updatedFields: Object.keys(data) },
  });

  return customer;
}
