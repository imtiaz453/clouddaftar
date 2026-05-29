"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createAuditLog, createNotification } from "@/lib/audit";
import { sendPushNotificationWithAdmins } from "@/lib/push";
import {
  computePaymentStatus,
  createLedgerEntry,
  recalculateLedgerBalances,
} from "@/lib/accounting";
import { getAccountBalances, seedDefaultAccounts } from "@/lib/coa-accounting";
import {
  deleteOperationalJournal,
  postCustomerPaymentJournal,
  postSupplierPaymentJournal,
} from "@/lib/operational-journals";
import type { PaginatedResponse } from "@/types";

function toNumber(val: any): number {
  return Number(val) || 0;
}

function agingBucketFromDate(
  dueDate: Date | null | undefined,
  amount: number,
  now: Date,
): keyof typeof EMPTY_AGING_BUCKETS {
  if (amount <= 0) return "current";

  // No due date means the system cannot calculate a due-date bucket.
  // Keep it in Current until a real due date is saved.
  if (!dueDate) return "current";

  const dueDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  /**
   * This page is being used as a due-date bucket report.
   * So we bucket by due-date distance from today:
   * - due today = Current
   * - due in / overdue by 1-30 days = 1-30
   * - due in / overdue by 31-60 days = 31-60
   * - due in / overdue by 61-90 days = 61-90
   * - due in / overdue by more than 90 days = 90+
   */
  const daysFromToday = Math.floor(
    (dueDay.getTime() - today.getTime()) / 86400000,
  );

  const absoluteDays = Math.abs(daysFromToday);

  if (absoluteDays === 0) return "current";
  if (absoluteDays <= 30) return "days1to30";
  if (absoluteDays <= 60) return "days31to60";
  if (absoluteDays <= 90) return "days61to90";

  return "days90plus";
}

const EMPTY_AGING_BUCKETS = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 };

const POSTED_RECEIVABLE_STATUSES = ["COMPLETED", "PARTIALLY_REFUNDED"];

function parseLocalDay(value: string, boundary: "start" | "end") {
  const parts = value.split("-").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [year, month, day] = parts;
    return boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  const date = new Date(value);
  if (boundary === "start") date.setHours(0, 0, 0, 0);
  else date.setHours(23, 59, 59, 999);
  return date;
}

function dateRange(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return undefined;
  const filter: Record<string, Date> = {};
  if (dateFrom) filter.gte = parseLocalDay(dateFrom, "start");
  if (dateTo) filter.lte = parseLocalDay(dateTo, "end");
  return filter;
}

function plainCustomer(customer: any) {
  if (!customer) return null;
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    companyName: customer.companyName,
    taxId: customer.taxId,
    notes: customer.notes,
    creditLimit: toNumber(customer.creditLimit),
    openingBalance: toNumber(customer.openingBalance),
    totalPurchases: toNumber(customer.totalPurchases),
    companyId: customer.companyId,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    deletedAt: customer.deletedAt,
  };
}

function plainSupplier(supplier: any) {
  if (!supplier) return null;
  return {
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    city: supplier.city,
    companyName: supplier.companyName,
    taxId: supplier.taxId,
    notes: supplier.notes,
    totalSales: toNumber(supplier.totalSales),
    openingBalance: toNumber(supplier.openingBalance),
    companyId: supplier.companyId,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    deletedAt: supplier.deletedAt,
  };
}

export async function getAccountingDashboard() {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  await seedDefaultAccounts(companyId);

  const [
    invoiceDueAgg,
    invoiceUnpaidCount,
    invoiceLateAgg,
    invoiceLateCount,
    invoiceToValidateCount,
    billDueAgg,
    billUnpaidCount,
    billLateAgg,
    billLateCount,
    billToValidateCount,
    customerPaymentAgg,
    supplierPaymentAgg,
    expenseSubmittedAgg,
    expenseApprovedAgg,
    recentPayments,
    productsForValuation,
    salesTaxAgg,
    purchaseTaxAgg,
    customerCount,
    supplierCount,
    reconciliationCount,
    ledgerEntryCount,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        companyId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      _sum: { due: true },
    }),
    prisma.sale.count({
      where: {
        companyId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
    }),
    prisma.sale.aggregate({
      where: {
        companyId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      _sum: { due: true },
    }),
    prisma.sale.count({
      where: {
        companyId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
    }),
    prisma.sale.count({
      where: { companyId, deletedAt: null, status: "DRAFT" as any },
    }),
    prisma.purchase.aggregate({
      where: {
        companyId,
        deletedAt: null,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      _sum: { due: true },
    }),
    prisma.purchase.count({
      where: {
        companyId,
        deletedAt: null,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
    }),
    prisma.purchase.aggregate({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      _sum: { due: true },
    }),
    prisma.purchase.count({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
    }),
    prisma.purchase.count({
      where: { companyId, deletedAt: null, status: "DRAFT" as any },
    }),
    prisma.payment.aggregate({
      where: {
        companyId,
        customerId: { not: null },
        paymentDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        companyId,
        supplierId: { not: null },
        paymentDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, status: "SUBMITTED" },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, status: "APPROVED" },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { companyId, paymentDate: { gte: new Date(now.getTime() - 30 * 86400000) } },
      select: { amount: true, paymentDate: true, customerId: true, supplierId: true },
      orderBy: { paymentDate: "asc" },
    }),
    prisma.product.findMany({
      where: { companyId, deletedAt: null, isService: false },
      select: { stock: true, purchasePrice: true },
    }),
    prisma.sale.aggregate({
      where: {
        companyId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { tax: true },
    }),
    prisma.purchase.aggregate({
      where: { companyId, deletedAt: null, createdAt: { gte: monthStart, lt: monthEnd } },
      _sum: { tax: true },
    }),
    prisma.customer.count({ where: { companyId, deletedAt: null, isActive: true } }),
    prisma.supplier.count({ where: { companyId, deletedAt: null, isActive: true } }),
    prisma.reconciliation.count({ where: { companyId } }),
    prisma.ledgerEntry.count({ where: { companyId } }),
  ]);

  const trend = new Map<string, { date: string; received: number; paid: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().split("T")[0];
    trend.set(key, { date: key, received: 0, paid: 0 });
  }
  for (const payment of recentPayments) {
    const key = new Date(payment.paymentDate).toISOString().split("T")[0];
    const row = trend.get(key);
    if (!row) continue;
    if (payment.customerId) row.received += toNumber(payment.amount);
    if (payment.supplierId) row.paid += toNumber(payment.amount);
  }

  const accountBalances = await getAccountBalances(companyId);
  const findBalance = (code: string) =>
    accountBalances.find((account) => account.code === code)?.balance ?? 0;
  const receivableBalance = findBalance("1.1.3") || toNumber(invoiceDueAgg._sum.due);
  const payableBalance = findBalance("2.1.1") || toNumber(billDueAgg._sum.due);
  const bankBalance =
    findBalance("1.1.2") ||
    toNumber(customerPaymentAgg._sum.amount) - toNumber(supplierPaymentAgg._sum.amount);
  const cashBalance = findBalance("1.1.1") || toNumber(customerPaymentAgg._sum.amount);
  const inventoryValue = productsForValuation.reduce(
    (sum, product) => sum + product.stock * toNumber(product.purchasePrice),
    0,
  );
  const outputTax = toNumber(salesTaxAgg._sum.tax);
  const inputTax = toNumber(purchaseTaxAgg._sum.tax);

  return {
    customerInvoices: {
      toValidate: invoiceToValidateCount,
      unpaid: invoiceUnpaidCount,
      unpaidAmount: toNumber(invoiceDueAgg._sum.due),
      late: invoiceLateCount,
      lateAmount: toNumber(invoiceLateAgg._sum.due),
    },
    vendorBills: {
      toValidate: billToValidateCount,
      toPay: billUnpaidCount,
      toPayAmount: toNumber(billDueAgg._sum.due),
      late: billLateCount,
      lateAmount: toNumber(billLateAgg._sum.due),
    },
    bank: {
      balance: bankBalance,
      paymentsIn: toNumber(customerPaymentAgg._sum.amount),
      paymentsOut: toNumber(supplierPaymentAgg._sum.amount),
      toReconcile: 0,
    },
    cash: {
      balance: cashBalance,
      received: toNumber(customerPaymentAgg._sum.amount),
      paid: toNumber(supplierPaymentAgg._sum.amount),
    },
    expenses: {
      underValidation: toNumber(expenseSubmittedAgg._sum.amount),
      toReimburse: toNumber(expenseApprovedAgg._sum.amount),
    },
    chartOfAccounts: accountBalances
      .filter((account) =>
        ["1.1.1", "1.1.2", "1.1.3", "1.1.4", "2.1.1", "2.1.2"].includes(account.code),
      )
      .map((account) => ({
        code: account.code,
        name: account.name,
        type: account.type.replace(/_/g, " "),
        balance:
          account.code === "1.1.4" && account.balance === 0 ? inventoryValue : account.balance,
        reconcile: ["1.1.2", "1.1.3", "2.1.1"].includes(account.code),
      })),
    tax: {
      outputTax,
      inputTax,
      netTax: outputTax - inputTax,
    },
    controls: {
      customers: customerCount,
      vendors: supplierCount,
      reconciliations: reconciliationCount,
      ledgerEntries: ledgerEntryCount,
      inventoryValue,
    },
    trend: Array.from(trend.values()),
  };
}

// =========== RECEIVABLES ===========

export async function getReceivableDashboard() {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    totalAgg,
    overdueAgg,
    partiallyPaidCount,
    todayPaymentsAgg,
    monthlyPaymentsAgg,
    overdueCustomerIds,
    agingRecords,
    lastYearPayments,
    last30Sales,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        companyId,
        deletedAt: null,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      _sum: { due: true },
    }),
    prisma.sale.aggregate({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      _sum: { due: true },
    }),
    prisma.sale.count({
      where: {
        companyId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
        paymentStatus: "PARTIALLY_PAID" as any,
      },
    }),
    prisma.payment.aggregate({
      where: {
        companyId,
        paymentDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { companyId, paymentDate: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
        customerId: { not: null },
      },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
    prisma.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      select: {
        dueDate: true,
        due: true,
        customerId: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.findMany({
      where: {
        companyId,
        paymentDate: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) },
      },
      select: { amount: true, paymentDate: true },
    }),
    prisma.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
        createdAt: { gte: new Date(now.getTime() - 30 * 86400000) },
      },
      select: { createdAt: true, due: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalReceivables = toNumber(totalAgg._sum.due);
  const overdueReceivables = toNumber(overdueAgg._sum.due);

  const agingBuckets = { ...EMPTY_AGING_BUCKETS };
  for (const r of agingRecords) {
    const amt = toNumber(r.due);
    const bucket = agingBucketFromDate(r.dueDate, amt, now);
    agingBuckets[bucket] += amt;
  }

  const monthlyMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const p of lastYearPayments) {
    const d = new Date(p.paymentDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(key)) monthlyMap.set(key, monthlyMap.get(key)! + toNumber(p.amount));
  }
  const monthlyCollectionTrend = Array.from(monthlyMap.entries()).map(([month, amount]) => ({
    month,
    amount,
  }));

  const dailyMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dailyMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const s of last30Sales) {
    const key = new Date(s.createdAt).toISOString().split("T")[0];
    if (dailyMap.has(key)) dailyMap.set(key, dailyMap.get(key)! + toNumber(s.due));
  }
  const outstandingTrend = Array.from(dailyMap.entries()).map(([date, amount]) => ({
    date,
    amount,
  }));

  const custMap = new Map<
    string,
    { id: string; name: string; totalDue: number; overdueDays: number }
  >();
  for (const r of agingRecords) {
    if (!r.customerId || !r.customer) continue;
    const amt = toNumber(r.due);
    if (amt <= 0) continue;
    const days =
      r.dueDate && r.dueDate < now
        ? Math.floor((now.getTime() - r.dueDate.getTime()) / 86400000)
        : 0;
    const existing = custMap.get(r.customerId);
    if (existing) {
      existing.totalDue += amt;
      if (days > existing.overdueDays) existing.overdueDays = days;
    } else {
      custMap.set(r.customerId, {
        id: r.customerId,
        name: r.customer.name,
        totalDue: amt,
        overdueDays: days,
      });
    }
  }
  const topOverdueCustomers = Array.from(custMap.values())
    .sort((a, b) => b.totalDue - a.totalDue)
    .slice(0, 5);

  return {
    totalReceivables,
    overdueReceivables,
    partiallyPaidInvoices: partiallyPaidCount,
    todayCollections: toNumber(todayPaymentsAgg._sum.amount),
    monthlyCollections: toNumber(monthlyPaymentsAgg._sum.amount),
    overdueCustomersCount: overdueCustomerIds.length,
    agingBuckets,
    monthlyCollectionTrend,
    outstandingTrend,
    topOverdueCustomers,
  };
}

export async function getReceivables(params?: {
  search?: string;
  customerId?: string;
  status?: string;
  overdueOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}): Promise<PaginatedResponse<any>> {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const where: Record<string, unknown> = {
    companyId,
    deletedAt: null,
    status: { in: POSTED_RECEIVABLE_STATUSES },
  };

  if (params?.customerId) where.customerId = params.customerId;
  if (params?.status) where.paymentStatus = params.status;
  if (params?.overdueOnly) {
    where.dueDate = { lt: new Date() };
    where.paymentStatus = { notIn: ["PAID", "CANCELLED", "RETURNED"] };
  }
  const createdAtRange = dateRange(params?.dateFrom, params?.dateTo);
  if (createdAtRange) where.createdAt = createdAtRange;
  if (params?.search) {
    where.OR = [
      { invoiceNumber: { contains: params.search, mode: "insensitive" } },
      { customer: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const orderBy: Record<string, string> = {};
  orderBy[params?.sortBy || "createdAt"] = params?.sortOrder || "desc";

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where: where as any,
      include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: orderBy as any,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.sale.count({ where: where as any }),
  ]);

  return {
    data: sales.map((s) => ({
      ...s,
      total: toNumber(s.total),
      paid: toNumber(s.paid),
      due: toNumber(s.due),
      subtotal: toNumber(s.subtotal),
      discount: toNumber(s.discount),
      tax: toNumber(s.tax),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getReceivableDetail(saleId: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, companyId, deletedAt: null },
    include: {
      customer: true,
      payments: { include: { payment: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  });
  if (!sale) throw new Error("Sale not found");

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { companyId, customerId: sale.customerId!, referenceId: saleId },
    orderBy: { entryDate: "asc" },
  });

  const reminders = await prisma.paymentReminder.findMany({
    where: { companyId, saleId },
    orderBy: { createdAt: "desc" },
  });

  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    total: toNumber(sale.total),
    paid: toNumber(sale.paid),
    due: toNumber(sale.due),
    subtotal: toNumber(sale.subtotal),
    discount: toNumber(sale.discount),
    tax: toNumber(sale.tax),
    status: sale.status,
    paymentStatus: sale.paymentStatus,
    paymentMethod: sale.paymentMethod,
    notes: sale.notes,
    dueDate: sale.dueDate,
    customerId: sale.customerId,
    companyId: sale.companyId,
    branchId: sale.branchId,
    warehouseId: sale.warehouseId,
    createdById: sale.createdById,
    updatedById: sale.updatedById,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    deletedAt: sale.deletedAt,
    taxComplianceMode: sale.taxComplianceMode,
    taxComplianceStatus: sale.taxComplianceStatus,
    fbrInvoiceNumber: sale.fbrInvoiceNumber,
    fbrQrPayload: sale.fbrQrPayload,
    zatcaQrPayload: sale.zatcaQrPayload,
    zatcaPhase: sale.zatcaPhase,
    zatcaInvoiceHash: sale.zatcaInvoiceHash,
    zatcaSubmissionStatus: sale.zatcaSubmissionStatus,
    zatcaUuid: sale.zatcaUuid,
    zatcaXmlPath: sale.zatcaXmlPath,
    zatcaResponseJson: sale.zatcaResponseJson,
    sellerTaxNumber: sale.sellerTaxNumber,
    buyerTaxNumber: sale.buyerTaxNumber,
    customer: plainCustomer(sale.customer),
    items: sale.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      quantity: item.quantity,
      price: toNumber(item.price),
      discount: toNumber(item.discount),
      tax: toNumber(item.tax),
      subtotal: toNumber(item.subtotal),
      product: item.product,
    })),
    ledgerEntries: ledgerEntries.map((e) => ({
      id: e.id,
      companyId: e.companyId,
      customerId: e.customerId,
      supplierId: e.supplierId,
      type: e.type,
      referenceId: e.referenceId,
      referenceNumber: e.referenceNumber,
      debit: toNumber(e.debit),
      credit: toNumber(e.credit),
      balance: toNumber(e.balance),
      entryDate: e.entryDate,
      description: e.description,
      createdById: e.createdById,
      createdAt: e.createdAt,
    })),
    reminders,
    payments: sale.payments.map((pa) => ({
      id: pa.id,
      paymentId: pa.paymentId,
      saleId: pa.saleId,
      purchaseId: pa.purchaseId,
      allocatedAmount: toNumber(pa.allocatedAmount),
      payment: {
        id: pa.payment.id,
        companyId: pa.payment.companyId,
        customerId: pa.payment.customerId,
        supplierId: pa.payment.supplierId,
        amount: toNumber(pa.payment.amount),
        paymentMethod: pa.payment.paymentMethod,
        reference: pa.payment.reference,
        notes: pa.payment.notes,
        paymentDate: pa.payment.paymentDate,
        createdById: pa.payment.createdById,
        createdAt: pa.payment.createdAt,
      },
    })),
  };
}

export async function receivePayment(data: {
  customerId?: string | null;
  saleIds: string[];
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  paymentDate?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const payment = await prisma.$transaction(async (tx) => {
    if (data.amount <= 0) throw new Error("Payment amount must be positive");
    if (data.saleIds.length === 0) throw new Error("At least one invoice is required");

    const customerId = data.customerId || null;
    if (customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!customer) throw new Error("Customer not found");
    }

    const sales = await tx.sale.findMany({
      where: {
        id: { in: data.saleIds },
        companyId,
        customerId,
        deletedAt: null,
        status: { in: POSTED_RECEIVABLE_STATUSES } as any,
      },
      orderBy: { createdAt: "asc" },
    });
    if (sales.length !== new Set(data.saleIds).size) {
      throw new Error("One or more invoices are invalid for this customer");
    }

    const totalDue = sales.reduce((sum, s) => sum + toNumber(s.due), 0);
    if (totalDue <= 0) throw new Error("Selected invoices have no outstanding balance");
    if (data.amount - totalDue > 0.01) {
      throw new Error("Payment amount cannot exceed selected invoice balance");
    }

    const payment = await tx.payment.create({
      data: {
        companyId,
        customerId,
        amount: data.amount,
        paymentMethod: data.paymentMethod as any,
        reference: data.reference,
        notes: data.notes,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        createdById: userId,
      },
    });

    let remaining = data.amount;
    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];
      const saleDue = toNumber(sale.due);
      const isLast = i === sales.length - 1;
      const allocAmount = isLast ? remaining : Math.min(saleDue, remaining);

      if (allocAmount <= 0) continue;

      await tx.paymentAllocation.create({
        data: { paymentId: payment.id, saleId: sale.id, allocatedAmount: allocAmount },
      });

      const newPaid = toNumber(sale.paid) + allocAmount;
      const newDue = Math.max(0, toNumber(sale.total) - newPaid);
      const paymentStatus = computePaymentStatus(toNumber(sale.total), newPaid);

      await tx.sale.update({
        where: { id: sale.id },
        data: { paid: newPaid, due: newDue, paymentStatus: paymentStatus as any },
      });

      await tx.ledgerEntry.create({
        data: {
          companyId,
          customerId,
          type: "PAYMENT",
          referenceId: payment.id,
          referenceNumber: sale.invoiceNumber,
          debit: 0,
          credit: allocAmount,
          balance: 0,
          entryDate: new Date(),
          description: `Payment received for invoice ${sale.invoiceNumber}`,
          createdById: userId,
        },
      });

      remaining -= allocAmount;
    }

    if (customerId) {
      await recalculateLedgerBalances(tx, companyId, customerId, null);
    }

    await postCustomerPaymentJournal(tx, {
      companyId,
      userId,
      paymentId: payment.id,
      referenceNumber: data.reference || payment.id,
      customerId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      date: payment.paymentDate,
    });

    return payment;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Payment",
    entityId: payment.id,
    metadata: {
      customerId: data.customerId || null,
      amount: data.amount,
      saleCount: data.saleIds.length,
      paymentMethod: data.paymentMethod,
    },
  });

  const customerName = data.customerId
    ? (await prisma.customer.findUnique({ where: { id: data.customerId }, select: { name: true } }))?.name || null
    : null;
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Payment Received",
    body: `Rs ${data.amount} received${customerName ? ` from ${customerName}` : ""} — ${data.paymentMethod} — by ${user.name || userId}`,
    url: "/accounting/receivables",
  });

  revalidatePath("/accounting/receivables");
  revalidatePath("/customers");
  return payment;
}

export async function allocatePayment(
  paymentId: string,
  allocations: { saleId: string; amount: number }[],
) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId, companyId },
      include: { allocations: true },
    });
    if (!payment) throw new Error("Payment not found");

    const totalAllocated = allocations.reduce((s, a) => s + a.amount, 0);
    if (Math.abs(totalAllocated - toNumber(payment.amount)) > 0.01) {
      throw new Error("Total allocated amount must match payment amount");
    }

    for (const oldAlloc of payment.allocations) {
      if (oldAlloc.saleId) {
        const sale = await tx.sale.findUnique({ where: { id: oldAlloc.saleId } });
        if (sale) {
          const reversedPaid = Math.max(
            0,
            toNumber(sale.paid) - toNumber(oldAlloc.allocatedAmount),
          );
          const newDue = toNumber(sale.total) - reversedPaid;
          const paymentStatus = computePaymentStatus(toNumber(sale.total), reversedPaid);
          await tx.sale.update({
            where: { id: sale.id },
            data: { paid: reversedPaid, due: newDue, paymentStatus: paymentStatus as any },
          });
        }
      }
    }

    await tx.paymentAllocation.deleteMany({ where: { paymentId } });
    await tx.ledgerEntry.deleteMany({
      where: { referenceId: paymentId, companyId, type: "PAYMENT" },
    });
    await deleteOperationalJournal(tx, companyId, `PAYMENT:${paymentId}`);

    for (const alloc of allocations) {
      await tx.paymentAllocation.create({
        data: { paymentId, saleId: alloc.saleId, allocatedAmount: alloc.amount },
      });

      const sale = await tx.sale.findUnique({ where: { id: alloc.saleId } });
      if (sale) {
        const newPaid = toNumber(sale.paid) + alloc.amount;
        const newDue = Math.max(0, toNumber(sale.total) - newPaid);
        const paymentStatus = computePaymentStatus(toNumber(sale.total), newPaid);
        await tx.sale.update({
          where: { id: sale.id },
          data: { paid: newPaid, due: newDue, paymentStatus: paymentStatus as any },
        });

        await tx.ledgerEntry.create({
          data: {
            companyId,
            customerId: payment.customerId,
            type: "PAYMENT",
            referenceId: sale.id,
            referenceNumber: sale.invoiceNumber,
            debit: 0,
            credit: alloc.amount,
            balance: 0,
            entryDate: new Date(),
            description: `Payment allocated to invoice ${sale.invoiceNumber}`,
            createdById: userId,
          },
        });
      }
    }

    if (payment.customerId) {
      await recalculateLedgerBalances(tx, companyId, payment.customerId, null);
    }

    await postCustomerPaymentJournal(tx, {
      companyId,
      userId,
      paymentId: payment.id,
      referenceNumber: payment.reference || payment.id,
      customerId: payment.customerId,
      amount: toNumber(payment.amount),
      paymentMethod: payment.paymentMethod,
      date: payment.paymentDate,
    });
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Payment",
    entityId: paymentId,
    metadata: { allocations: allocations.length },
  });

  revalidatePath("/accounting/receivables");
}

export async function sendPaymentReminder(data: {
  customerId?: string;
  supplierId?: string;
  saleId?: string;
  purchaseId?: string;
  type: string;
  message: string;
  contactMethod?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const reminder = await prisma.paymentReminder.create({
    data: {
      companyId,
      customerId: data.customerId || null,
      supplierId: data.supplierId || null,
      saleId: data.saleId || null,
      purchaseId: data.purchaseId || null,
      type: data.type,
      message: data.message,
      status: "SENT",
      contactMethod: data.contactMethod,
      remindedAt: new Date(),
      createdById: userId,
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "PaymentReminder",
    entityId: reminder.id,
    metadata: { type: data.type, contactMethod: data.contactMethod },
  });

  await createNotification({
    companyId,
    userId,
    title: "Payment Reminder Sent",
    message: `${data.type} reminder sent${data.customerId ? " to customer" : ""}${data.supplierId ? " to supplier" : ""}`,
    type: "INFO",
  });
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Payment Reminder Sent",
    body: `${data.type} reminder sent by ${user.name || userId}`,
    url: "/accounting/receivables",
  });

  revalidatePath("/accounting/receivables");
  return reminder;
}

export async function createPaymentReminder(data: {
  customerId?: string;
  supplierId?: string;
  saleId?: string;
  purchaseId?: string;
  type: string;
  message?: string;
  contactMethod?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const reminder = await prisma.paymentReminder.create({
    data: {
      companyId,
      customerId: data.customerId || null,
      supplierId: data.supplierId || null,
      saleId: data.saleId || null,
      purchaseId: data.purchaseId || null,
      type: data.type,
      message: data.message,
      status: "PENDING",
      contactMethod: data.contactMethod,
      createdById: userId,
    },
  });

  return reminder;
}

export async function getPaymentReminders(params?: {
  entityType?: string;
  entityId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<any>> {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const where: Record<string, unknown> = { companyId };
  if (params?.status) where.status = params.status;
  if (params?.entityType === "customer" && params?.entityId) where.customerId = params.entityId;
  if (params?.entityType === "supplier" && params?.entityId) where.supplierId = params.entityId;
  if (params?.entityType === "sale" && params?.entityId) where.saleId = params.entityId;
  if (params?.entityType === "purchase" && params?.entityId) where.purchaseId = params.entityId;

  const [reminders, total] = await Promise.all([
    prisma.paymentReminder.findMany({
      where: where as any,
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentReminder.count({ where: where as any }),
  ]);

  return { data: reminders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getCustomerAging(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const now = new Date();
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const where: Record<string, unknown> = { companyId, isActive: true, deletedAt: null };
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where: where as any,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where: where as any }),
  ]);

  const sales = await prisma.sale.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { in: POSTED_RECEIVABLE_STATUSES } as any,
      paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      customerId: { in: customers.map((c) => c.id) },
    },
    select: { customerId: true, dueDate: true, due: true },
  });

  const agingData = customers.map((customer) => {
    const customerSales = sales.filter((s) => s.customerId === customer.id);
    const buckets = { ...EMPTY_AGING_BUCKETS, totalDue: 0 };
    for (const s of customerSales) {
      const amt = toNumber(s.due);
      buckets.totalDue += amt;
      const bucket = agingBucketFromDate(s.dueDate, amt, now);
      buckets[bucket] += amt;
    }
    return { customer, ...buckets };
  });

  const summary = agingData.reduce(
    (acc, curr) => ({
      totalCurrent: acc.totalCurrent + curr.current,
      total1to30: acc.total1to30 + curr.days1to30,
      total31to60: acc.total31to60 + curr.days31to60,
      total61to90: acc.total61to90 + curr.days61to90,
      total90plus: acc.total90plus + curr.days90plus,
      totalOverdue: acc.totalOverdue + curr.totalDue - curr.current,
    }),
    {
      totalCurrent: 0,
      total1to30: 0,
      total31to60: 0,
      total61to90: 0,
      total90plus: 0,
      totalOverdue: 0,
    },
  );

  return { agingData, summary, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getCustomerLedger(
  customerId: string,
  params?: {
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 50;

  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) throw new Error("Customer not found");

  const where: Record<string, unknown> = { companyId, customerId };
  const entryDateRange = dateRange(params?.dateFrom, params?.dateTo);
  if (entryDateRange) where.entryDate = entryDateRange;

  const [entries, total, totals, latestEntry] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: where as any,
      orderBy: { entryDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ledgerEntry.count({ where: where as any }),
    prisma.ledgerEntry.aggregate({
      where: where as any,
      _sum: { debit: true, credit: true },
    }),
    prisma.ledgerEntry.findFirst({
      where: where as any,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      select: { balance: true },
    }),
  ]);

  const summary = {
    totalDebit: toNumber(totals._sum.debit),
    totalCredit: toNumber(totals._sum.credit),
    balance: toNumber(latestEntry?.balance),
  };

  return {
    entries: entries.map((e) => ({
      ...e,
      debit: toNumber(e.debit),
      credit: toNumber(e.credit),
      balance: toNumber(e.balance),
    })),
    customer,
    summary,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function setOpeningBalance(data: {
  customerId?: string;
  supplierId?: string;
  amount: number;
  direction: string;
  reason?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  if (!data.customerId && !data.supplierId)
    throw new Error("Either customerId or supplierId is required");

  await prisma.$transaction(async (tx) => {
    const adjustment = await tx.balanceAdjustment.create({
      data: {
        companyId,
        customerId: data.customerId || null,
        supplierId: data.supplierId || null,
        type: "OPENING_BALANCE",
        amount: data.amount,
        direction: data.direction,
        reason: data.reason,
        createdById: userId,
      },
    });

    const debit = data.direction === "DEBIT" ? data.amount : 0;
    const credit = data.direction === "CREDIT" ? data.amount : 0;

    if (data.customerId) {
      await tx.customer.update({
        where: { id: data.customerId },
        data: {
          openingBalance: { increment: data.direction === "DEBIT" ? data.amount : -data.amount },
        },
      });

      await tx.ledgerEntry.create({
        data: {
          companyId,
          customerId: data.customerId,
          type: "ADJUSTMENT",
          referenceId: adjustment.id,
          referenceNumber: "OPENING-BAL",
          debit,
          credit,
          balance: 0,
          entryDate: new Date(),
          description: data.reason || "Opening balance adjustment",
          createdById: userId,
        },
      });

      await recalculateLedgerBalances(tx, companyId, data.customerId, null);
    }

    if (data.supplierId) {
      await tx.supplier.update({
        where: { id: data.supplierId },
        data: {
          openingBalance: { increment: data.direction === "DEBIT" ? data.amount : -data.amount },
        },
      });

      await tx.ledgerEntry.create({
        data: {
          companyId,
          supplierId: data.supplierId,
          type: "ADJUSTMENT",
          referenceId: adjustment.id,
          referenceNumber: "OPENING-BAL",
          debit,
          credit,
          balance: 0,
          entryDate: new Date(),
          description: data.reason || "Opening balance adjustment",
          createdById: userId,
        },
      });

      await recalculateLedgerBalances(tx, companyId, null, data.supplierId);
    }
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "BalanceAdjustment",
      metadata: {
        customerId: data.customerId,
        supplierId: data.supplierId,
        amount: data.amount,
        direction: data.direction,
      },
    });

    await createNotification({
      companyId,
      userId,
      title: "Opening Balance Adjusted",
      message: `Rs ${data.amount} ${data.direction} adjustment for ${data.customerId ? "customer" : "supplier"}`,
      type: "INFO",
    });
    await sendPushNotificationWithAdmins(companyId, userId, {
      title: "Opening Balance Adjusted",
      body: `Rs ${data.amount} ${data.direction} — opening balance adjusted by ${user.name || userId}`,
      url: "/accounting/receivables",
    });

    revalidatePath("/accounting/receivables");
    revalidatePath("/customers");
  }

export async function getReconciliations(params?: {
  type?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<any>> {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const where: Record<string, unknown> = { companyId };
  if (params?.type) where.type = params.type;
  if (params?.status) where.status = params.status;

  const [reconciliations, total] = await Promise.all([
    prisma.reconciliation.findMany({
      where: where as any,
      include: {
        allocations: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reconciliation.count({ where: where as any }),
  ]);

  return {
    data: reconciliations.map((r) => ({
      ...r,
      totalAllocated: toNumber(r.totalAllocated),
      totalMatched: toNumber(r.totalMatched),
      difference: toNumber(r.difference),
      allocations: r.allocations.map((a) => ({
        ...a,
        allocatedAmount: toNumber(a.allocatedAmount),
        matchedAmount: toNumber(a.matchedAmount),
        difference: toNumber(a.difference),
      })),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function createReconciliation(data: {
  type: string;
  referenceId?: string;
  referenceType?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const reconciliation = await prisma.reconciliation.create({
    data: {
      companyId,
      type: data.type,
      referenceId: data.referenceId || null,
      referenceType: data.referenceType || null,
      createdById: userId,
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Reconciliation",
    entityId: reconciliation.id,
    metadata: { type: data.type },
  });

  await createNotification({
    companyId,
    userId,
    title: "Reconciliation Created",
    message: `${data.type} reconciliation created`,
    type: "INFO",
  });
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Reconciliation Created",
    body: `${data.type} reconciliation created by ${user.name || userId}`,
    url: "/accounting/reconciliation",
  });

  revalidatePath("/accounting/reconciliation");
  return reconciliation;
}

export async function performReconciliation(
  reconciliationId: string,
  allocations: {
    paymentId?: string;
    saleId?: string;
    purchaseId?: string;
    ledgerEntryId?: string;
    allocatedAmount: number;
  }[],
) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const recon = await prisma.reconciliation.findFirst({
    where: { id: reconciliationId, companyId },
  });
  if (!recon) throw new Error("Reconciliation not found");

  const result = await prisma.$transaction(async (tx) => {
    let totalAllocated = 0;
    let totalMatched = 0;

    for (const alloc of allocations) {
      // Verify each referenced entity belongs to the same company
      if (alloc.paymentId) {
        const payment = await tx.payment.findUnique({
          where: { id: alloc.paymentId },
          select: { companyId: true },
        });
        if (!payment || payment.companyId !== companyId) throw new Error("Payment not found");
      }
      if (alloc.saleId) {
        const sale = await tx.sale.findUnique({
          where: { id: alloc.saleId },
          select: { companyId: true },
        });
        if (!sale || sale.companyId !== companyId) throw new Error("Sale not found");
      }
      if (alloc.purchaseId) {
        const purchase = await tx.purchase.findUnique({
          where: { id: alloc.purchaseId },
          select: { companyId: true },
        });
        if (!purchase || purchase.companyId !== companyId) throw new Error("Purchase not found");
      }
      if (alloc.ledgerEntryId) {
        const entry = await tx.ledgerEntry.findUnique({
          where: { id: alloc.ledgerEntryId },
          select: { companyId: true },
        });
        if (!entry || entry.companyId !== companyId) throw new Error("Ledger entry not found");
      }

      await tx.reconciliationAllocation.create({
        data: {
          reconciliationId,
          paymentId: alloc.paymentId || null,
          saleId: alloc.saleId || null,
          purchaseId: alloc.purchaseId || null,
          ledgerEntryId: alloc.ledgerEntryId || null,
          allocatedAmount: alloc.allocatedAmount,
          matchedAmount: alloc.allocatedAmount,
          difference: 0,
          status: "MATCHED",
        },
      });
      totalAllocated += alloc.allocatedAmount;
      totalMatched += alloc.allocatedAmount;
    }

    const difference = totalAllocated - totalMatched;
    const status = Math.abs(difference) < 0.01 ? "RECONCILED" : "MISMATCHED";

    const updated = await tx.reconciliation.update({
      where: { id: reconciliationId },
      data: {
        totalAllocated,
        totalMatched,
        difference,
        status,
        reconciledAt: status === "RECONCILED" ? new Date() : undefined,
      },
      include: { allocations: true },
    });

    return updated;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "Reconciliation",
    entityId: reconciliationId,
    metadata: { allocationsCount: allocations.length, status: result.status },
  });

  revalidatePath("/accounting/reconciliation");
  return {
    ...result,
    totalAllocated: toNumber(result.totalAllocated),
    totalMatched: toNumber(result.totalMatched),
    difference: toNumber(result.difference),
  };
}

export async function reverseAllocation(reconciliationAllocationId: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  await prisma.$transaction(async (tx) => {
    const alloc = await tx.reconciliationAllocation.findUnique({
      where: { id: reconciliationAllocationId },
      include: { reconciliation: true },
    });
    if (!alloc || alloc.reconciliation.companyId !== companyId)
      throw new Error("Allocation not found");

    await tx.reconciliationAllocation.update({
      where: { id: reconciliationAllocationId },
      data: { status: "ADJUSTED" },
    });

    const recon = alloc.reconciliation;
    const newTotalAllocated = toNumber(recon.totalAllocated) - toNumber(alloc.allocatedAmount);
    const newTotalMatched = toNumber(recon.totalMatched) - toNumber(alloc.matchedAmount);
    const newDifference = newTotalAllocated - newTotalMatched;
    const newStatus =
      Math.abs(newDifference) < 0.01 ? "RECONCILED" : newTotalAllocated > 0 ? "MISMATCHED" : "OPEN";

    await tx.reconciliation.update({
      where: { id: alloc.reconciliationId },
      data: {
        totalAllocated: newTotalAllocated,
        totalMatched: newTotalMatched,
        difference: newDifference,
        status: newStatus,
      },
    });
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "ReconciliationAllocation",
    entityId: reconciliationAllocationId,
    metadata: { action: "reversed" },
  });

  revalidatePath("/accounting/reconciliation");
}

export async function adjustBalance(data: {
  customerId?: string;
  supplierId?: string;
  type: string;
  amount: number;
  direction: string;
  reason?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  if (!data.customerId && !data.supplierId)
    throw new Error("Either customerId or supplierId is required");

  const adjustment = await prisma.$transaction(async (tx) => {
    const adj = await tx.balanceAdjustment.create({
      data: {
        companyId,
        customerId: data.customerId || null,
        supplierId: data.supplierId || null,
        type: data.type,
        amount: data.amount,
        direction: data.direction,
        reason: data.reason,
        createdById: userId,
      },
    });

    const debit = data.direction === "DEBIT" ? data.amount : 0;
    const credit = data.direction === "CREDIT" ? data.amount : 0;

    if (data.customerId) {
      await tx.ledgerEntry.create({
        data: {
          companyId,
          customerId: data.customerId,
          type: "ADJUSTMENT",
          referenceId: adj.id,
          referenceNumber: `ADJ-${adj.id.slice(0, 8)}`,
          debit,
          credit,
          balance: 0,
          entryDate: new Date(),
          description: data.reason || `${data.type} adjustment`,
          createdById: userId,
        },
      });
      await recalculateLedgerBalances(tx, companyId, data.customerId, null);
    }

    if (data.supplierId) {
      await tx.ledgerEntry.create({
        data: {
          companyId,
          supplierId: data.supplierId,
          type: "ADJUSTMENT",
          referenceId: adj.id,
          referenceNumber: `ADJ-${adj.id.slice(0, 8)}`,
          debit,
          credit,
          balance: 0,
          entryDate: new Date(),
          description: data.reason || `${data.type} adjustment`,
          createdById: userId,
        },
      });
      await recalculateLedgerBalances(tx, companyId, null, data.supplierId);
    }

    return adj;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "BalanceAdjustment",
    entityId: adjustment.id,
    metadata: { type: data.type, amount: data.amount, direction: data.direction },
  });

  await createNotification({
    companyId,
    userId,
    title: "Balance Adjusted",
    message: `Rs ${data.amount} ${data.direction} — ${data.type}`,
    type: "INFO",
  });
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Balance Adjusted",
    body: `Rs ${data.amount} ${data.direction} — ${data.type} — by ${user.name || userId}`,
    url: "/accounting",
  });

  revalidatePath("/accounting");
  return adjustment;
}

// =========== PAYABLES ===========

export async function getPayableDashboard() {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    totalAgg,
    overdueAgg,
    partiallyPaidCount,
    todayPaymentsAgg,
    monthlyPaymentsAgg,
    overdueSupplierIds,
    agingRecords,
    lastYearPayments,
    last30Purchases,
  ] = await Promise.all([
    prisma.purchase.aggregate({
      where: {
        companyId,
        deletedAt: null,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      _sum: { due: true },
    }),
    prisma.purchase.aggregate({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      _sum: { due: true },
    }),
    prisma.purchase.count({
      where: { companyId, deletedAt: null, paymentStatus: "PARTIALLY_PAID" as any },
    }),
    prisma.payment.aggregate({
      where: {
        companyId,
        paymentDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
        supplierId: { not: null },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        companyId,
        paymentDate: { gte: monthStart, lt: monthEnd },
        supplierId: { not: null },
      },
      _sum: { amount: true },
    }),
    prisma.purchase.findMany({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
        supplierId: { not: null },
      },
      select: { supplierId: true },
      distinct: ["supplierId"],
    }),
    prisma.purchase.findMany({
      where: {
        companyId,
        deletedAt: null,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      select: {
        dueDate: true,
        due: true,
        supplierId: true,
        supplier: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.findMany({
      where: {
        companyId,
        paymentDate: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) },
        supplierId: { not: null },
      },
      select: { amount: true, paymentDate: true },
    }),
    prisma.purchase.findMany({
      where: {
        companyId,
        deletedAt: null,
        createdAt: { gte: new Date(now.getTime() - 30 * 86400000) },
      },
      select: { createdAt: true, due: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const totalPayables = toNumber(totalAgg._sum.due);
  const overduePayables = toNumber(overdueAgg._sum.due);

  const agingBuckets = { ...EMPTY_AGING_BUCKETS };
  for (const r of agingRecords) {
    const amt = toNumber(r.due);
    const bucket = agingBucketFromDate(r.dueDate, amt, now);
    agingBuckets[bucket] += amt;
  }

  const monthlyMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const p of lastYearPayments) {
    const d = new Date(p.paymentDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(key)) monthlyMap.set(key, monthlyMap.get(key)! + toNumber(p.amount));
  }
  const monthlyPaymentTrend = Array.from(monthlyMap.entries()).map(([month, amount]) => ({
    month,
    amount,
  }));

  const dailyMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dailyMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const p of last30Purchases) {
    const key = new Date(p.createdAt).toISOString().split("T")[0];
    if (dailyMap.has(key)) dailyMap.set(key, dailyMap.get(key)! + toNumber(p.due));
  }
  const outstandingTrend = Array.from(dailyMap.entries()).map(([date, amount]) => ({
    date,
    amount,
  }));

  const suppMap = new Map<
    string,
    { id: string; name: string; totalDue: number; overdueDays: number }
  >();
  for (const r of agingRecords) {
    if (!r.supplierId || !r.supplier) continue;
    const amt = toNumber(r.due);
    if (amt <= 0) continue;
    const days =
      r.dueDate && r.dueDate < now
        ? Math.floor((now.getTime() - r.dueDate.getTime()) / 86400000)
        : 0;
    const existing = suppMap.get(r.supplierId);
    if (existing) {
      existing.totalDue += amt;
      if (days > existing.overdueDays) existing.overdueDays = days;
    } else {
      suppMap.set(r.supplierId, {
        id: r.supplierId,
        name: r.supplier.name,
        totalDue: amt,
        overdueDays: days,
      });
    }
  }
  const topOverdueSuppliers = Array.from(suppMap.values())
    .sort((a, b) => b.totalDue - a.totalDue)
    .slice(0, 5);

  return {
    totalPayables,
    overduePayables,
    partiallyPaidInvoices: partiallyPaidCount,
    todayPayments: toNumber(todayPaymentsAgg._sum.amount),
    monthlyPayments: toNumber(monthlyPaymentsAgg._sum.amount),
    overdueSuppliersCount: overdueSupplierIds.length,
    agingBuckets,
    monthlyPaymentTrend,
    outstandingTrend,
    topOverdueSuppliers,
  };
}

export async function getPayables(params?: {
  purchaseId?: string;
  search?: string;
  supplierId?: string;
  status?: string;
  overdueOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}): Promise<PaginatedResponse<any>> {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const where: Record<string, unknown> = { companyId, deletedAt: null };

  if (params?.purchaseId) where.id = params.purchaseId;
  if (params?.supplierId) where.supplierId = params.supplierId;
  if (params?.status) {
    const statuses = params.status
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean);
    where.paymentStatus = statuses.length > 1 ? { in: statuses } : statuses[0];
  }
  if (params?.overdueOnly) {
    where.dueDate = { lt: new Date() };
    where.paymentStatus = { notIn: ["PAID", "CANCELLED", "RETURNED"] };
  }
  const createdAtRange = dateRange(params?.dateFrom, params?.dateTo);
  if (createdAtRange) where.createdAt = createdAtRange;
  if (params?.search) {
    where.OR = [
      { referenceNumber: { contains: params.search, mode: "insensitive" } },
      { supplier: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const orderBy: Record<string, string> = {};
  orderBy[params?.sortBy || "createdAt"] = params?.sortOrder || "desc";

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where: where as any,
      include: { supplier: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: orderBy as any,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchase.count({ where: where as any }),
  ]);

  return {
    data: purchases.map((p) => {
      const due = toNumber(p.due);
      const dueDate = p.dueDate ? new Date(p.dueDate) : null;
      const overdueDays =
        due > 0 && dueDate && dueDate < new Date()
          ? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
      return {
        ...p,
        supplierName: p.supplier?.name ?? null,
        purchaseDate: p.createdAt,
        total: toNumber(p.total),
        paid: toNumber(p.paid),
        due,
        balance: due,
        overdueDays,
        status: p.paymentStatus,
        subtotal: toNumber(p.subtotal),
        discount: toNumber(p.discount),
        tax: toNumber(p.tax),
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getPayableDetail(purchaseId: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, companyId, deletedAt: null },
    include: {
      supplier: true,
      payments: { include: { payment: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  });
  if (!purchase) throw new Error("Purchase not found");

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { companyId, supplierId: purchase.supplierId!, referenceId: purchaseId },
    orderBy: { entryDate: "asc" },
  });

  return {
    id: purchase.id,
    referenceNumber: purchase.referenceNumber,
    total: toNumber(purchase.total),
    paid: toNumber(purchase.paid),
    due: toNumber(purchase.due),
    subtotal: toNumber(purchase.subtotal),
    discount: toNumber(purchase.discount),
    tax: toNumber(purchase.tax),
    status: purchase.status,
    paymentStatus: purchase.paymentStatus,
    paymentMethod: purchase.paymentMethod,
    notes: purchase.notes,
    dueDate: purchase.dueDate,
    supplierId: purchase.supplierId,
    companyId: purchase.companyId,
    branchId: purchase.branchId,
    warehouseId: purchase.warehouseId,
    createdById: purchase.createdById,
    updatedById: purchase.updatedById,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
    deletedAt: purchase.deletedAt,
    supplier: plainSupplier(purchase.supplier),
    items: purchase.items.map((item) => ({
      id: item.id,
      purchaseId: item.purchaseId,
      productId: item.productId,
      quantity: item.quantity,
      price: toNumber(item.price),
      discount: toNumber(item.discount),
      tax: toNumber(item.tax),
      subtotal: toNumber(item.subtotal),
      product: item.product,
    })),
    ledgerEntries: ledgerEntries.map((e) => ({
      id: e.id,
      companyId: e.companyId,
      customerId: e.customerId,
      supplierId: e.supplierId,
      type: e.type,
      referenceId: e.referenceId,
      referenceNumber: e.referenceNumber,
      debit: toNumber(e.debit),
      credit: toNumber(e.credit),
      balance: toNumber(e.balance),
      entryDate: e.entryDate,
      description: e.description,
      createdById: e.createdById,
      createdAt: e.createdAt,
    })),
    payments: purchase.payments.map((pa) => ({
      id: pa.id,
      paymentId: pa.paymentId,
      saleId: pa.saleId,
      purchaseId: pa.purchaseId,
      allocatedAmount: toNumber(pa.allocatedAmount),
      payment: {
        id: pa.payment.id,
        companyId: pa.payment.companyId,
        customerId: pa.payment.customerId,
        supplierId: pa.payment.supplierId,
        amount: toNumber(pa.payment.amount),
        paymentMethod: pa.payment.paymentMethod,
        reference: pa.payment.reference,
        notes: pa.payment.notes,
        paymentDate: pa.payment.paymentDate,
        createdById: pa.payment.createdById,
        createdAt: pa.payment.createdAt,
      },
    })),
  };
}

export async function paySupplier(data: {
  supplierId: string;
  purchaseIds: string[];
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  paymentDate?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const payment = await prisma.$transaction(async (tx) => {
    if (data.amount <= 0) throw new Error("Payment amount must be positive");
    if (data.purchaseIds.length === 0) throw new Error("At least one purchase is required");

    const supplier = await tx.supplier.findFirst({
      where: { id: data.supplierId, companyId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!supplier) throw new Error("Supplier not found");

    const purchases = await tx.purchase.findMany({
      where: {
        id: { in: data.purchaseIds },
        companyId,
        supplierId: data.supplierId,
        deletedAt: null,
        status: { notIn: ["DRAFT", "CANCELLED"] },
      },
      orderBy: { createdAt: "asc" },
    });
    if (purchases.length !== new Set(data.purchaseIds).size) {
      throw new Error("One or more purchases are invalid for this supplier");
    }

    const totalDue = purchases.reduce((sum, p) => sum + toNumber(p.due), 0);
    if (totalDue <= 0) throw new Error("Selected purchases have no outstanding balance");
    if (data.amount - totalDue > 0.01) {
      throw new Error("Payment amount cannot exceed selected purchase balance");
    }

    const payment = await tx.payment.create({
      data: {
        companyId,
        supplierId: data.supplierId,
        amount: data.amount,
        paymentMethod: data.paymentMethod as any,
        reference: data.reference,
        notes: data.notes,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        createdById: userId,
      },
    });

    let remaining = data.amount;
    for (let i = 0; i < purchases.length; i++) {
      const purchase = purchases[i];
      const purchaseDue = toNumber(purchase.due);
      const isLast = i === purchases.length - 1;
      const allocAmount = isLast ? remaining : Math.min(purchaseDue, remaining);

      if (allocAmount <= 0) continue;

      await tx.paymentAllocation.create({
        data: { paymentId: payment.id, purchaseId: purchase.id, allocatedAmount: allocAmount },
      });

      const newPaid = toNumber(purchase.paid) + allocAmount;
      const newDue = Math.max(0, toNumber(purchase.total) - newPaid);
      const paymentStatus = computePaymentStatus(toNumber(purchase.total), newPaid);

      await tx.purchase.update({
        where: { id: purchase.id },
        data: { paid: newPaid, due: newDue, paymentStatus: paymentStatus as any },
      });

      await tx.ledgerEntry.create({
        data: {
          companyId,
          supplierId: data.supplierId,
          type: "PAYMENT",
          referenceId: payment.id,
          referenceNumber: purchase.referenceNumber,
          debit: 0,
          credit: allocAmount,
          balance: 0,
          entryDate: new Date(),
          description: `Payment made for purchase ${purchase.referenceNumber}`,
          createdById: userId,
        },
      });

      remaining -= allocAmount;
    }

    await recalculateLedgerBalances(tx, companyId, null, data.supplierId);

    await postSupplierPaymentJournal(tx, {
      companyId,
      userId,
      paymentId: payment.id,
      referenceNumber: data.reference || payment.id,
      supplierId: data.supplierId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      date: payment.paymentDate,
    });

    return payment;
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Payment",
    entityId: payment.id,
    metadata: {
      supplierId: data.supplierId,
      amount: data.amount,
      purchaseCount: data.purchaseIds.length,
      paymentMethod: data.paymentMethod,
    },
  });

  const supplierName = data.supplierId
    ? (await prisma.supplier.findUnique({ where: { id: data.supplierId }, select: { name: true } }))?.name || null
    : null;
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Payment Sent",
    body: `Rs ${data.amount} paid${supplierName ? ` to ${supplierName}` : ""} — ${data.paymentMethod} — by ${user.name || userId}`,
    url: "/accounting/payables",
  });

  revalidatePath("/accounting/payables");
  revalidatePath("/suppliers");
  return payment;
}

export async function getSupplierAging(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const now = new Date();
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const where: Record<string, unknown> = { companyId, isActive: true, deletedAt: null };
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where: where as any,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplier.count({ where: where as any }),
  ]);

  const purchases = await prisma.purchase.findMany({
    where: {
      companyId,
      deletedAt: null,
      paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      supplierId: { in: suppliers.map((s) => s.id) },
    },
    select: { supplierId: true, dueDate: true, due: true },
  });

  const agingData = suppliers.map((supplier) => {
    const supplierPurchases = purchases.filter((p) => p.supplierId === supplier.id);
    const buckets = { ...EMPTY_AGING_BUCKETS, totalDue: 0 };
    for (const p of supplierPurchases) {
      const amt = toNumber(p.due);
      buckets.totalDue += amt;
      const bucket = agingBucketFromDate(p.dueDate, amt, now);
      buckets[bucket] += amt;
    }
    return { supplierId: supplier.id, supplierName: supplier.name, ...buckets };
  });

  const summary = agingData.reduce(
    (acc, curr) => ({
      totalCurrent: acc.totalCurrent + curr.current,
      total1to30: acc.total1to30 + curr.days1to30,
      total31to60: acc.total31to60 + curr.days31to60,
      total61to90: acc.total61to90 + curr.days61to90,
      total90plus: acc.total90plus + curr.days90plus,
      totalOverdue: acc.totalOverdue + curr.totalDue - curr.current,
    }),
    {
      totalCurrent: 0,
      total1to30: 0,
      total31to60: 0,
      total61to90: 0,
      total90plus: 0,
      totalOverdue: 0,
    },
  );

  return { agingData, summary, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getSupplierLedger(
  supplierId: string,
  params?: {
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 50;

  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId } });
  if (!supplier) throw new Error("Supplier not found");

  const where: Record<string, unknown> = { companyId, supplierId };
  const entryDateRange = dateRange(params?.dateFrom, params?.dateTo);
  if (entryDateRange) where.entryDate = entryDateRange;

  const [entries, total, totals, latestEntry] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: where as any,
      orderBy: { entryDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ledgerEntry.count({ where: where as any }),
    prisma.ledgerEntry.aggregate({
      where: where as any,
      _sum: { debit: true, credit: true },
    }),
    prisma.ledgerEntry.findFirst({
      where: where as any,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      select: { balance: true },
    }),
  ]);

  const summary = {
    totalDebit: toNumber(totals._sum.debit),
    totalCredit: toNumber(totals._sum.credit),
    balance: toNumber(latestEntry?.balance),
  };

  return {
    entries: entries.map((e) => ({
      ...e,
      debit: toNumber(e.debit),
      credit: toNumber(e.credit),
      balance: toNumber(e.balance),
    })),
    supplier,
    summary,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// =========== REPORTS ===========

export async function getAgingReport(type: "RECEIVABLE" | "PAYABLE") {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const now = new Date();

  if (type === "RECEIVABLE") {
    const customers = await prisma.customer.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
    });

    const sales = await prisma.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      select: { customerId: true, dueDate: true, due: true, invoiceNumber: true },
    });

    const report = customers.map((customer) => {
      const customerSales = sales.filter((s) => s.customerId === customer.id);
      const buckets = {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        totalDue: 0,
      };
      for (const s of customerSales) {
        const amt = toNumber(s.due);
        buckets.totalDue += amt;
        if (!s.dueDate || s.dueDate >= now) buckets.current += amt;
        else {
          const days = Math.floor((now.getTime() - s.dueDate.getTime()) / 86400000);
          if (days <= 30) buckets.days1to30 += amt;
          else if (days <= 60) buckets.days31to60 += amt;
          else if (days <= 90) buckets.days61to90 += amt;
          else buckets.days90plus += amt;
        }
      }
      return {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        ...buckets,
      };
    });

    return { type, data: report.filter((r) => r.totalDue > 0) };
  }

  const suppliers = await prisma.supplier.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
  });

  const purchases = await prisma.purchase.findMany({
    where: {
      companyId,
      deletedAt: null,
      paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
    },
    select: { supplierId: true, dueDate: true, due: true, referenceNumber: true },
  });

  const report = suppliers.map((supplier) => {
    const supplierPurchases = purchases.filter((p) => p.supplierId === supplier.id);
    const buckets = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      days90plus: 0,
      totalDue: 0,
    };
    for (const p of supplierPurchases) {
      const amt = toNumber(p.due);
      buckets.totalDue += amt;
      if (!p.dueDate || p.dueDate >= now) buckets.current += amt;
      else {
        const days = Math.floor((now.getTime() - p.dueDate.getTime()) / 86400000);
        if (days <= 30) buckets.days1to30 += amt;
        else if (days <= 60) buckets.days31to60 += amt;
        else if (days <= 90) buckets.days61to90 += amt;
        else buckets.days90plus += amt;
      }
    }
    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
      },
      ...buckets,
    };
  });

  return { type, data: report.filter((r) => r.totalDue > 0) };
}

export async function getCollectionReport(dateFrom: string, dateTo: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const payments = await prisma.payment.findMany({
    where: {
      companyId,
      paymentDate: dateRange(dateFrom, dateTo),
      customerId: { not: null },
    },
    include: {
      customer: { select: { id: true, name: true } },
      allocations: { include: { sale: { select: { invoiceNumber: true } } } },
      createdBy: { select: { name: true } },
    },
    orderBy: { paymentDate: "asc" },
  });

  const dailyCollection = new Map<string, number>();
  for (const p of payments) {
    const key = new Date(p.paymentDate).toISOString().split("T")[0];
    dailyCollection.set(key, (dailyCollection.get(key) || 0) + toNumber(p.amount));
  }

  return {
    payments: payments.map((p) => ({
      ...p,
      amount: toNumber(p.amount),
      allocations: p.allocations.map((a) => ({
        ...a,
        allocatedAmount: toNumber(a.allocatedAmount),
      })),
    })),
    totalCollected: payments.reduce((s, p) => s + toNumber(p.amount), 0),
    totalTransactions: payments.length,
    dailyCollection: Array.from(dailyCollection.entries()).map(([date, amount]) => ({
      date,
      amount,
    })),
  };
}

export async function getOutstandingReport(type: "CUSTOMER" | "SUPPLIER") {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  if (type === "CUSTOMER") {
    const customers = await prisma.customer.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: "asc" },
    });

    const sales = await prisma.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
      },
      select: {
        customerId: true,
        total: true,
        paid: true,
        due: true,
        invoiceNumber: true,
        dueDate: true,
      },
    });

    const data = customers.map((customer) => {
      const customerSales = sales.filter((s) => s.customerId === customer.id);
      return {
        customer,
        totalOutstanding: customerSales.reduce((s, inv) => s + toNumber(inv.due), 0),
        totalInvoiced: customerSales.reduce((s, inv) => s + toNumber(inv.total), 0),
        totalPaid: customerSales.reduce((s, inv) => s + toNumber(inv.paid), 0),
        invoiceCount: customerSales.length,
        invoices: customerSales.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          total: toNumber(inv.total),
          paid: toNumber(inv.paid),
          due: toNumber(inv.due),
          dueDate: inv.dueDate,
        })),
      };
    });

    return { type, data: data.filter((d) => d.totalOutstanding > 0) };
  }

  const suppliers = await prisma.supplier.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
  });

  const purchases = await prisma.purchase.findMany({
    where: {
      companyId,
      deletedAt: null,
      paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] } as any,
    },
    select: {
      supplierId: true,
      total: true,
      paid: true,
      due: true,
      referenceNumber: true,
      dueDate: true,
    },
  });

  const data = suppliers.map((supplier) => {
    const supplierPurchases = purchases.filter((p) => p.supplierId === supplier.id);
    return {
      supplier,
      totalOutstanding: supplierPurchases.reduce((s, p) => s + toNumber(p.due), 0),
      totalPurchased: supplierPurchases.reduce((s, p) => s + toNumber(p.total), 0),
      totalPaid: supplierPurchases.reduce((s, p) => s + toNumber(p.paid), 0),
      purchaseCount: supplierPurchases.length,
      purchases: supplierPurchases.map((p) => ({
        referenceNumber: p.referenceNumber,
        total: toNumber(p.total),
        paid: toNumber(p.paid),
        due: toNumber(p.due),
        dueDate: p.dueDate,
      })),
    };
  });

  return { type, data: data.filter((d) => d.totalOutstanding > 0) };
}

export async function getPaymentHistoryReport(params?: {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  supplierId?: string;
  paymentType?: "customer" | "supplier";
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<any>> {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const where: Record<string, unknown> = { companyId };
  if (params?.customerId) where.customerId = params.customerId;
  if (params?.supplierId) where.supplierId = params.supplierId;
  if (params?.paymentType === "customer" && !params.customerId) where.customerId = { not: null };
  if (params?.paymentType === "supplier" && !params.supplierId) where.supplierId = { not: null };
  const paymentDateRange = dateRange(params?.dateFrom, params?.dateTo);
  if (paymentDateRange) where.paymentDate = paymentDateRange;

  const payments = await prisma.payment.findMany({
    where: where as any,
    include: {
      customer: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      allocations: {
        include: {
          sale: { select: { invoiceNumber: true } },
          purchase: { select: { referenceNumber: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
    orderBy: { paymentDate: "desc" },
  });

  const paymentIds = payments.map((payment) => payment.id);
  const allocatedReferenceIds = payments
    .flatMap((payment) =>
      payment.allocations.flatMap((allocation) => [allocation.saleId, allocation.purchaseId]),
    )
    .filter((id): id is string => Boolean(id));
  const excludedLedgerReferenceIds = [...new Set([...paymentIds, ...allocatedReferenceIds])];

  let legacyLedgerPayments: any[] = [];
  if (params?.paymentType === "customer") {
    const ledgerWhere: Record<string, unknown> = {
      companyId,
      type: "PAYMENT",
      customerId: params.customerId || { not: null },
      credit: { gt: 0 },
      ...(excludedLedgerReferenceIds.length
        ? { referenceId: { notIn: excludedLedgerReferenceIds } }
        : {}),
    };
    const entryDateRange = dateRange(params?.dateFrom, params?.dateTo);
    if (entryDateRange) ledgerWhere.entryDate = entryDateRange;
    legacyLedgerPayments = await prisma.ledgerEntry.findMany({
      where: ledgerWhere as any,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { entryDate: "desc" },
    });
  }

  if (params?.paymentType === "supplier") {
    const ledgerWhere: Record<string, unknown> = {
      companyId,
      type: "PAYMENT",
      supplierId: params.supplierId || { not: null },
      credit: { gt: 0 },
      ...(excludedLedgerReferenceIds.length
        ? { referenceId: { notIn: excludedLedgerReferenceIds } }
        : {}),
    };
    const entryDateRange = dateRange(params?.dateFrom, params?.dateTo);
    if (entryDateRange) ledgerWhere.entryDate = entryDateRange;
    legacyLedgerPayments = await prisma.ledgerEntry.findMany({
      where: ledgerWhere as any,
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { entryDate: "desc" },
    });
  }

  const paymentRows = payments.map((p) => ({
    id: p.id,
    companyId: p.companyId,
    customerId: p.customerId,
    supplierId: p.supplierId,
    amount: toNumber(p.amount),
    paymentMethod: p.paymentMethod,
    reference: p.reference,
    notes: p.notes,
    paymentDate: p.paymentDate,
    createdById: p.createdById,
    createdAt: p.createdAt,
    customer: p.customer,
    supplier: p.supplier,
    createdBy: p.createdBy,
    allocations: p.allocations.map((a) => ({
      id: a.id,
      paymentId: a.paymentId,
      saleId: a.saleId,
      purchaseId: a.purchaseId,
      allocatedAmount: toNumber(a.allocatedAmount),
      sale: a.sale,
      purchase: a.purchase,
    })),
  }));

  const ledgerRows = legacyLedgerPayments.map((entry) => ({
    id: `ledger-${entry.id}`,
    companyId: entry.companyId,
    customerId: entry.customerId,
    supplierId: entry.supplierId,
    customer: entry.customer || null,
    supplier: entry.supplier || null,
    amount: toNumber(entry.credit),
    paymentMethod: "CASH",
    reference: entry.referenceNumber,
    notes: entry.description,
    paymentDate: entry.entryDate,
    createdById: entry.createdById,
    createdAt: entry.createdAt,
    createdBy: entry.createdBy,
    allocations: [],
    source: "ledger",
  }));

  const data = [...paymentRows, ...ledgerRows]
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    .slice((page - 1) * pageSize, page * pageSize);
  const total = paymentRows.length + ledgerRows.length;

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// =========== PAYMENT COMMITMENTS ===========

export async function createPaymentCommitment(data: {
  customerId?: string;
  supplierId?: string;
  saleId?: string;
  purchaseId?: string;
  amount: number;
  commitmentDate: string;
  expectedDate?: string;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const commitment = await prisma.paymentCommitment.create({
    data: {
      companyId,
      customerId: data.customerId || null,
      supplierId: data.supplierId || null,
      saleId: data.saleId || null,
      purchaseId: data.purchaseId || null,
      amount: data.amount,
      commitmentDate: new Date(data.commitmentDate),
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      notes: data.notes,
      createdById: userId,
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "PaymentCommitment",
    entityId: commitment.id,
    metadata: { amount: data.amount, commitmentDate: data.commitmentDate },
  });

  await createNotification({
    companyId,
    userId,
    title: "Payment Commitment Created",
    message: `Rs ${data.amount} commitment created`,
    type: "INFO",
  });
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Payment Commitment Created",
    body: `Rs ${data.amount} commitment created by ${user.name || userId}`,
    url: "/accounting/commitments",
  });

  revalidatePath("/accounting/commitments");
  return commitment;
}

export async function updatePaymentCommitment(
  id: string,
  data: {
    status?: string;
    fulfilledAmount?: number;
    notes?: string;
  },
) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.paymentCommitment.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error("Payment commitment not found");

  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.fulfilledAmount !== undefined) {
    updateData.fulfilledAmount = data.fulfilledAmount;
    updateData.fulfilledAt = new Date();
  }
  if (data.status === "FULFILLED" && !data.fulfilledAmount) {
    updateData.fulfilledAmount = existing.amount;
    updateData.fulfilledAt = new Date();
  }

  const commitment = await prisma.paymentCommitment.update({
    where: { id },
    data: updateData as any,
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "PaymentCommitment",
    entityId: id,
    metadata: data,
  });

  const commitmentStatus = data.status || "UPDATED";
  await createNotification({
    companyId,
    userId,
    title: `Payment Commitment ${commitmentStatus}`,
    message: `Commitment ${commitmentStatus.toLowerCase()}${data.fulfilledAmount ? ` — Rs ${data.fulfilledAmount} fulfilled` : ""}`,
    type: commitmentStatus === "FULFILLED" ? "SUCCESS" : "INFO",
  });
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: `Payment Commitment ${commitmentStatus}`,
    body: `Commitment ${commitmentStatus.toLowerCase()} — ${data.fulfilledAmount ? `Rs ${data.fulfilledAmount} fulfilled` : ""} — by ${user.name || userId}`,
    url: "/accounting/commitments",
  });

  revalidatePath("/accounting/commitments");
  return commitment;
}

export async function getPaymentCommitments(params?: {
  status?: string;
  customerId?: string;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<any>> {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;

  const where: Record<string, unknown> = { companyId };
  if (params?.status) where.status = params.status;
  if (params?.customerId) where.customerId = params.customerId;
  if (params?.supplierId) where.supplierId = params.supplierId;

  const [commitments, total] = await Promise.all([
    prisma.paymentCommitment.findMany({
      where: where as any,
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { commitmentDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentCommitment.count({ where: where as any }),
  ]);

  return {
    data: commitments.map((c) => ({
      ...c,
      amount: toNumber(c.amount),
      fulfilledAmount: toNumber(c.fulfilledAmount),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getCashFlow(params?: {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 50;

  const where: Record<string, unknown> = { companyId };
  const paymentDateRange = dateRange(params?.dateFrom, params?.dateTo);
  if (paymentDateRange) where.paymentDate = paymentDateRange;

  const salesDateRange = dateRange(params?.dateFrom, params?.dateTo);
  const purchasesDateRange = dateRange(params?.dateFrom, params?.dateTo);

  const [payments, allocations, directPaidSales, directPaidPurchases] = await Promise.all([
    prisma.payment.findMany({
      where: where as any,
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.paymentAllocation.findMany({
      where: { payment: { companyId } },
      select: { saleId: true, purchaseId: true, allocatedAmount: true },
    }),
    prisma.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: ["DRAFT", "CANCELLED", "REFUNDED"] },
        paid: { gt: 0 },
        ...(salesDateRange ? { createdAt: salesDateRange } : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        paid: { gt: 0 },
        ...(purchasesDateRange ? { createdAt: purchasesDateRange } : {}),
      },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const saleAllocatedAmounts = new Map<string, number>();
  const purchaseAllocatedAmounts = new Map<string, number>();
  for (const allocation of allocations) {
    if (allocation.saleId) {
      saleAllocatedAmounts.set(
        allocation.saleId,
        (saleAllocatedAmounts.get(allocation.saleId) || 0) + toNumber(allocation.allocatedAmount),
      );
    }
    if (allocation.purchaseId) {
      purchaseAllocatedAmounts.set(
        allocation.purchaseId,
        (purchaseAllocatedAmounts.get(allocation.purchaseId) || 0) + toNumber(allocation.allocatedAmount),
      );
    }
  }

  const paymentIds = payments.map((payment) => payment.id);
  const directSaleIds = directPaidSales
    .filter((sale) => toNumber(sale.paid) - (saleAllocatedAmounts.get(sale.id) || 0) > 0.01)
    .map((sale) => sale.id);
  const directPurchaseIds = directPaidPurchases
    .filter((purchase) => toNumber(purchase.paid) - (purchaseAllocatedAmounts.get(purchase.id) || 0) > 0.01)
    .map((purchase) => purchase.id);
  const allocatedReferenceIds = allocations
    .flatMap((allocation) => [allocation.saleId, allocation.purchaseId])
    .filter((id): id is string => Boolean(id));
  const excludedLedgerReferenceIds = [
    ...new Set([...paymentIds, ...allocatedReferenceIds, ...directSaleIds, ...directPurchaseIds]),
  ];

  const ledgerWhere: Record<string, unknown> = {
    companyId,
    type: "PAYMENT",
    credit: { gt: 0 },
    OR: [{ customerId: { not: null } }, { supplierId: { not: null } }],
    ...(excludedLedgerReferenceIds.length
      ? { referenceId: { notIn: excludedLedgerReferenceIds } }
      : {}),
  };
  const entryDateRange = dateRange(params?.dateFrom, params?.dateTo);
  if (entryDateRange) ledgerWhere.entryDate = entryDateRange;

  const expenseWhere: Record<string, unknown> = {
    companyId,
    status: "PAID",
  };
  const reimbursedAtRange = dateRange(params?.dateFrom, params?.dateTo);
  if (reimbursedAtRange) expenseWhere.reimbursedAt = reimbursedAtRange;

  const [legacyLedgerPayments, paidExpenses] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: ledgerWhere as any,
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { entryDate: "desc" },
    }),
    prisma.expense.findMany({
      where: expenseWhere as any,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: [{ reimbursedAt: "desc" }, { expenseDate: "desc" }],
    }),
  ]);

  const paymentRows = payments.map((p) => ({
    ...p,
    amount: toNumber(p.amount),
    type: (p.customerId ? "INFLOW" : "OUTFLOW") as "INFLOW" | "OUTFLOW",
    entityName: p.customer?.name || p.supplier?.name || "Unknown",
    source: "payment",
  }));

  const directSaleRows = directPaidSales
    .map((sale) => {
      const amount = toNumber(sale.paid) - (saleAllocatedAmounts.get(sale.id) || 0);
      return {
        id: `sale-paid-${sale.id}`,
        amount: Math.max(0, amount),
        paymentMethod: sale.paymentMethod || "CASH",
        paymentDate: sale.createdAt,
        type: "INFLOW" as const,
        entityName: sale.customer?.name || "Walk-in Customer",
        reference: sale.invoiceNumber,
        notes: "Direct invoice payment",
        customerId: sale.customerId,
        supplierId: null,
        customer: sale.customer || null,
        supplier: null,
        source: "sale",
      };
    })
    .filter((row) => row.amount > 0.01);

  const directPurchaseRows = directPaidPurchases
    .map((purchase) => {
      const amount = toNumber(purchase.paid) - (purchaseAllocatedAmounts.get(purchase.id) || 0);
      return {
        id: `purchase-paid-${purchase.id}`,
        amount: Math.max(0, amount),
        paymentMethod: purchase.paymentMethod || "CASH",
        paymentDate: purchase.createdAt,
        type: "OUTFLOW" as const,
        entityName: purchase.supplier?.name || "Direct Purchase",
        reference: purchase.referenceNumber,
        notes: "Direct purchase payment",
        customerId: null,
        supplierId: purchase.supplierId,
        customer: null,
        supplier: purchase.supplier || null,
        source: "purchase",
      };
    })
    .filter((row) => row.amount > 0.01);

  const ledgerRows = legacyLedgerPayments.map((entry) => ({
    id: `ledger-${entry.id}`,
    amount: toNumber(entry.credit),
    paymentMethod: "CASH",
    paymentDate: entry.entryDate,
    type: (entry.customerId ? "INFLOW" : "OUTFLOW") as "INFLOW" | "OUTFLOW",
    entityName: entry.customer?.name || entry.supplier?.name || "Ledger payment",
    reference: entry.referenceNumber,
    notes: entry.description,
    customerId: entry.customerId,
    supplierId: entry.supplierId,
    customer: entry.customer || null,
    supplier: entry.supplier || null,
    source: "ledger",
  }));

  const expenseRows = paidExpenses.map((expense) => ({
    id: `expense-${expense.id}`,
    amount: toNumber(expense.amount),
    paymentMethod: expense.paidBy || "EXPENSE",
    paymentDate: expense.reimbursedAt || expense.expenseDate,
    type: "OUTFLOW" as const,
    entityName: expense.employee?.name || expense.category || "Expense",
    reference: expense.category,
    notes: expense.description || expense.notes,
    customerId: null,
    supplierId: null,
    customer: null,
    supplier: null,
    source: "expense",
  }));

  const rows = [...paymentRows, ...directSaleRows, ...directPurchaseRows, ...ledgerRows, ...expenseRows].sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
  );

  const totalInflow = rows
    .filter((row) => row.type === "INFLOW")
    .reduce((sum, row) => sum + row.amount, 0);
  const totalOutflow = rows
    .filter((row) => row.type === "OUTFLOW")
    .reduce((sum, row) => sum + row.amount, 0);
  const data = rows.slice((page - 1) * pageSize, page * pageSize);

  return {
    data,
    summary: { totalInflow, totalOutflow, netCashFlow: totalInflow - totalOutflow },
    total: rows.length,
    page,
    pageSize,
    totalPages: Math.ceil(rows.length / pageSize),
  };
}

export async function getIncomeExpense(params?: {
  year?: number;
  monthFrom?: number;
  monthTo?: number;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;
  const year = params?.year || new Date().getFullYear();
  const monthFrom = params?.monthFrom || 1;
  const monthTo = params?.monthTo || 12;

  const startDate = new Date(year, monthFrom - 1, 1);
  const endDate = new Date(year, monthTo, 0, 23, 59, 59);

  const [sales, purchases] = await Promise.all([
    prisma.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true, total: true, status: true, paymentMethod: true },
    }),
    prisma.purchase.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true, total: true, status: true, paymentMethod: true },
    }),
  ]);

  const monthlyData: Record<string, { income: number; expense: number }> = {};
  for (let m = monthFrom; m <= monthTo; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    monthlyData[key] = { income: 0, expense: 0 };
  }

  let totalIncome = 0;
  let totalExpense = 0;

  for (const sale of sales) {
    const d = new Date(sale.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const amount = toNumber(sale.total);
    if (monthlyData[key]) monthlyData[key].income += amount;
    totalIncome += amount;
  }

  for (const purchase of purchases) {
    const d = new Date(purchase.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const amount = toNumber(purchase.total);
    if (monthlyData[key]) monthlyData[key].expense += amount;
    totalExpense += amount;
  }

  const paymentMethodIncome: Record<string, number> = {};
  const paymentMethodExpense: Record<string, number> = {};
  for (const sale of sales) {
    const method = sale.paymentMethod;
    paymentMethodIncome[method] = (paymentMethodIncome[method] || 0) + toNumber(sale.total);
  }
  for (const purchase of purchases) {
    const method = purchase.paymentMethod;
    paymentMethodExpense[method] = (paymentMethodExpense[method] || 0) + toNumber(purchase.total);
  }

  return {
    monthly: Object.entries(monthlyData).map(([month, data]) => ({ month, ...data })),
    summary: { totalIncome, totalExpense, netProfit: totalIncome - totalExpense },
    paymentMethodIncome,
    paymentMethodExpense,
    year,
    monthFrom,
    monthTo,
  };
}

export async function checkOverduePayments() {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [overdueSales, overduePurchases] = await Promise.all([
    prisma.sale.findMany({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] },
        status: { notIn: ["DRAFT", "CANCELLED", "REFUNDED"] },
      },
      include: { customer: { select: { name: true } } },
    }),
    prisma.purchase.findMany({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: todayStart },
        paymentStatus: { notIn: ["PAID", "CANCELLED", "RETURNED"] },
        status: { notIn: ["DRAFT", "CANCELLED"] },
      },
      include: { supplier: { select: { name: true } } },
    }),
  ]);

  let created = 0;

  for (const sale of overdueSales) {
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(sale.dueDate!).getTime()) / (1000 * 60 * 60 * 24),
    );
    const existing = await prisma.notification.findFirst({
      where: {
        companyId,
        userId,
        title: "Overdue Payment",
        link: `/accounts-receivable/${sale.id}`,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (!existing) {
      await createNotification({
        companyId,
        userId,
        title: "Overdue Payment",
        message: `${sale.invoiceNumber} from ${sale.customer?.name || "Unknown"} is ${daysOverdue}d overdue (Rs ${toNumber(sale.due).toFixed(0)})`,
        type: "WARNING",
        link: `/accounts-receivable`,
      });
      await sendPushNotificationWithAdmins(companyId, userId, {
        title: "Overdue Payment",
        body: `${sale.invoiceNumber} from ${sale.customer?.name || "Unknown"} — Rs ${toNumber(sale.due).toFixed(0)} due — ${daysOverdue}d overdue`,
        url: `/accounts-receivable?saleId=${sale.id}`,
      });
      created++;
    }
  }

  for (const purchase of overduePurchases) {
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(purchase.dueDate!).getTime()) / (1000 * 60 * 60 * 24),
    );
    const existing = await prisma.notification.findFirst({
      where: {
        companyId,
        userId,
        title: "Overdue Payment",
        link: `/accounts-payable/${purchase.id}`,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (!existing) {
      await createNotification({
        companyId,
        userId,
        title: "Overdue Payable",
        message: `${purchase.referenceNumber} to ${purchase.supplier?.name || "Unknown"} is ${daysOverdue}d overdue (Rs ${toNumber(purchase.due).toFixed(0)})`,
        type: "WARNING",
        link: `/accounts-payable`,
      });
      await sendPushNotificationWithAdmins(companyId, userId, {
        title: "Overdue Payable",
        body: `${purchase.referenceNumber} to ${purchase.supplier?.name || "Unknown"} — Rs ${toNumber(purchase.due).toFixed(0)} due — ${daysOverdue}d overdue`,
        url: `/accounts-payable?purchaseId=${purchase.id}`,
      });
      created++;
    }
  }

  return { created, overdueSales: overdueSales.length, overduePurchases: overduePurchases.length };
}
