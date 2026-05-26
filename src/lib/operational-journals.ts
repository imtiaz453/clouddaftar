import type { AccountType, JournalType } from "@prisma/client";
import { reserveNextJournalNumber } from "@/lib/journal-numbers";

type Tx = any;

const ACCOUNT = {
  cash: { code: "1.1.1", name: "Cash", type: "ASSET" as AccountType },
  bank: { code: "1.1.2", name: "Bank", type: "ASSET" as AccountType },
  receivable: { code: "1.1.3", name: "Accounts Receivable", type: "ASSET" as AccountType },
  inventory: { code: "1.1.4", name: "Inventory", type: "ASSET" as AccountType },
  payable: { code: "2.1.1", name: "Accounts Payable", type: "LIABILITY" as AccountType },
  taxPayable: { code: "2.1.2", name: "Sales Tax Payable", type: "LIABILITY" as AccountType },
  accruedExpenses: { code: "2.1.4", name: "Accrued Expenses", type: "LIABILITY" as AccountType },
  sales: { code: "4.1", name: "Sales Revenue", type: "INCOME" as AccountType },
  cogs: { code: "5.1.1", name: "COGS - Product", type: "EXPENSE" as AccountType },
  operatingExpense: { code: "5.2", name: "Operating Expenses", type: "EXPENSE" as AccountType },
};

function round(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function positive(value: number) {
  return round(Math.max(0, value));
}

function isBankPayment(method?: string | null) {
  const normalized = String(method || "").toUpperCase();
  return ["BANK", "BANK_TRANSFER", "NET_BANKING", "CARD", "CHEQUE", "CHECK", "ONLINE"].some(
    (token) => normalized.includes(token),
  );
}

async function getAccount(tx: Tx, companyId: string, key: keyof typeof ACCOUNT) {
  const account = ACCOUNT[key];
  const existing = await tx.coaAccount.findFirst({
    where: { companyId, code: account.code },
  });
  if (existing) return existing;
  return tx.coaAccount.create({
    data: {
      companyId,
      code: account.code,
      name: account.name,
      type: account.type,
      isActive: true,
    },
  });
}

async function postAutoJournal(
  tx: Tx,
  params: {
    companyId: string;
    userId: string;
    reference: string;
    numberReference: string;
    date?: Date;
    description: string;
    journalType: JournalType;
    lines: {
      accountId: string;
      debit?: number;
      credit?: number;
      partnerId?: string | null;
      description?: string;
    }[];
  },
) {
  const lines = params.lines
    .map((line) => ({
      ...line,
      debit: positive(line.debit || 0),
      credit: positive(line.credit || 0),
    }))
    .filter((line) => line.debit > 0 || line.credit > 0);

  const debit = round(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = round(lines.reduce((sum, line) => sum + line.credit, 0));
  if (lines.length < 2 || Math.abs(debit - credit) > 0.01) return null;

  await tx.journalEntryMaster.deleteMany({
    where: { companyId: params.companyId, reference: params.reference },
  });

  const number = await reserveNextJournalNumber(tx, params.companyId, params.journalType);

  return tx.journalEntryMaster.create({
    data: {
      number,
      date: params.date || new Date(),
      reference: params.reference,
      description: params.description,
      journalType: params.journalType,
      companyId: params.companyId,
      createdById: params.userId,
      isPosted: true,
      postedAt: new Date(),
      lines: {
        create: lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          partnerId: line.partnerId || null,
          description: line.description || params.numberReference,
        })),
      },
    },
  });
}

export async function deleteOperationalJournal(tx: Tx, companyId: string, reference: string) {
  await tx.journalEntryMaster.deleteMany({ where: { companyId, reference } });
}

export async function postSaleJournal(
  tx: Tx,
  params: {
    companyId: string;
    userId: string;
    saleId: string;
    invoiceNumber: string;
    customerId?: string | null;
    total: number;
    tax: number;
    paid: number;
    paymentMethod?: string | null;
    costOfGoods?: number;
    date?: Date;
  },
) {
  const cashAccount = await getAccount(
    tx,
    params.companyId,
    isBankPayment(params.paymentMethod) ? "bank" : "cash",
  );
  const ar = await getAccount(tx, params.companyId, "receivable");
  const sales = await getAccount(tx, params.companyId, "sales");
  const tax = await getAccount(tx, params.companyId, "taxPayable");
  const inventory = await getAccount(tx, params.companyId, "inventory");
  const cogs = await getAccount(tx, params.companyId, "cogs");
  const paid = positive(params.paid);
  const due = positive(params.total - paid);
  const revenue = positive(params.total - params.tax);
  const taxAmount = positive(params.tax);
  const cost = positive(params.costOfGoods || 0);

  return postAutoJournal(tx, {
    companyId: params.companyId,
    userId: params.userId,
    reference: `SALE:${params.saleId}`,
    numberReference: params.invoiceNumber,
    date: params.date,
    description: `Sale invoice ${params.invoiceNumber}`,
    journalType: "SALES",
    lines: [
      { accountId: cashAccount.id, debit: paid, description: "Payment received" },
      {
        accountId: ar.id,
        debit: due,
        partnerId: params.customerId,
        description: "Invoice receivable",
      },
      { accountId: sales.id, credit: revenue, description: "Sales revenue" },
      { accountId: tax.id, credit: taxAmount, description: "Output tax" },
      { accountId: cogs.id, debit: cost, description: "Cost of goods sold" },
      { accountId: inventory.id, credit: cost, description: "Inventory issued" },
    ],
  });
}

export async function postPurchaseJournal(
  tx: Tx,
  params: {
    companyId: string;
    userId: string;
    purchaseId: string;
    referenceNumber: string;
    supplierId?: string | null;
    total: number;
    tax: number;
    paid: number;
    paymentMethod?: string | null;
    date?: Date;
  },
) {
  const cashAccount = await getAccount(
    tx,
    params.companyId,
    isBankPayment(params.paymentMethod) ? "bank" : "cash",
  );
  const inventory = await getAccount(tx, params.companyId, "inventory");
  const tax = await getAccount(tx, params.companyId, "taxPayable");
  const payable = await getAccount(tx, params.companyId, "payable");
  const paid = positive(params.paid);
  const due = positive(params.total - paid);
  const inventoryValue = positive(params.total - params.tax);
  const taxAmount = positive(params.tax);

  return postAutoJournal(tx, {
    companyId: params.companyId,
    userId: params.userId,
    reference: `PURCHASE:${params.purchaseId}`,
    numberReference: params.referenceNumber,
    date: params.date,
    description: `Purchase ${params.referenceNumber}`,
    journalType: "PURCHASES",
    lines: [
      { accountId: inventory.id, debit: inventoryValue, description: "Inventory purchased" },
      { accountId: tax.id, debit: taxAmount, description: "Input tax" },
      { accountId: cashAccount.id, credit: paid, description: "Payment made" },
      {
        accountId: payable.id,
        credit: due,
        partnerId: params.supplierId,
        description: "Purchase payable",
      },
    ],
  });
}

export async function postCustomerPaymentJournal(
  tx: Tx,
  params: {
    companyId: string;
    userId: string;
    paymentId: string;
    referenceNumber: string;
    customerId?: string | null;
    amount: number;
    paymentMethod?: string | null;
    date?: Date;
  },
) {
  const cashAccount = await getAccount(
    tx,
    params.companyId,
    isBankPayment(params.paymentMethod) ? "bank" : "cash",
  );
  const ar = await getAccount(tx, params.companyId, "receivable");
  return postAutoJournal(tx, {
    companyId: params.companyId,
    userId: params.userId,
    reference: `PAYMENT:${params.paymentId}`,
    numberReference: params.referenceNumber,
    date: params.date,
    description: `Customer payment ${params.referenceNumber}`,
    journalType: "RECEIPT",
    lines: [
      { accountId: cashAccount.id, debit: params.amount, description: "Cash/bank received" },
      {
        accountId: ar.id,
        credit: params.amount,
        partnerId: params.customerId,
        description: "Receivable settled",
      },
    ],
  });
}

export async function postSupplierPaymentJournal(
  tx: Tx,
  params: {
    companyId: string;
    userId: string;
    paymentId: string;
    referenceNumber: string;
    supplierId?: string | null;
    amount: number;
    paymentMethod?: string | null;
    date?: Date;
  },
) {
  const cashAccount = await getAccount(
    tx,
    params.companyId,
    isBankPayment(params.paymentMethod) ? "bank" : "cash",
  );
  const payable = await getAccount(tx, params.companyId, "payable");
  return postAutoJournal(tx, {
    companyId: params.companyId,
    userId: params.userId,
    reference: `PAYMENT:${params.paymentId}`,
    numberReference: params.referenceNumber,
    date: params.date,
    description: `Supplier payment ${params.referenceNumber}`,
    journalType: "PAYMENT",
    lines: [
      {
        accountId: payable.id,
        debit: params.amount,
        partnerId: params.supplierId,
        description: "Payable settled",
      },
      { accountId: cashAccount.id, credit: params.amount, description: "Cash/bank paid" },
    ],
  });
}

export async function postExpenseJournal(
  tx: Tx,
  params: {
    companyId: string;
    userId: string;
    expenseId: string;
    description: string;
    amount: number;
    status: string;
    paidBy?: string | null;
    date?: Date;
  },
) {
  const expense = await getAccount(tx, params.companyId, "operatingExpense");
  const creditAccount =
    params.status === "PAID"
      ? await getAccount(
          tx,
          params.companyId,
          String(params.paidBy || "")
            .toUpperCase()
            .includes("BANK")
            ? "bank"
            : "cash",
        )
      : await getAccount(tx, params.companyId, "accruedExpenses");

  return postAutoJournal(tx, {
    companyId: params.companyId,
    userId: params.userId,
    reference: `EXPENSE:${params.expenseId}`,
    numberReference: params.expenseId,
    date: params.date,
    description: params.description,
    journalType: params.status === "PAID" ? "PAYMENT" : "GENERAL",
    lines: [
      { accountId: expense.id, debit: params.amount, description: params.description },
      {
        accountId: creditAccount.id,
        credit: params.amount,
        description: params.status === "PAID" ? "Expense paid" : "Expense accrued",
      },
    ],
  });
}
