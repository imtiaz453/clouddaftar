import { prisma } from "@/lib/prisma";
import type { AccountType, JournalType, Prisma } from "@prisma/client";

export const DEFAULT_ACCOUNTS: {
  code: string;
  name: string;
  type: AccountType;
  children?: { code: string; name: string; type: AccountType }[];
}[] = [
  {
    code: "1",
    name: "Assets",
    type: "ASSET",
    children: [
      { code: "1.1", name: "Current Assets", type: "ASSET" },
      { code: "1.1.1", name: "Cash", type: "ASSET" },
      { code: "1.1.2", name: "Bank", type: "ASSET" },
      { code: "1.1.3", name: "Accounts Receivable", type: "ASSET" },
      { code: "1.1.4", name: "Inventory", type: "ASSET" },
      { code: "1.1.5", name: "Prepaid Expenses", type: "ASSET" },
      { code: "1.2", name: "Fixed Assets", type: "ASSET" },
      { code: "1.2.1", name: "Building & Property", type: "ASSET" },
      { code: "1.2.2", name: "Furniture & Fixtures", type: "ASSET" },
      { code: "1.2.3", name: "Equipment", type: "ASSET" },
      { code: "1.2.4", name: "Vehicles", type: "ASSET" },
      { code: "1.2.5", name: "Accumulated Depreciation", type: "CONTRA_ASSET" },
    ],
  },
  {
    code: "2",
    name: "Liabilities",
    type: "LIABILITY",
    children: [
      { code: "2.1", name: "Current Liabilities", type: "LIABILITY" },
      { code: "2.1.1", name: "Accounts Payable", type: "LIABILITY" },
      { code: "2.1.2", name: "Sales Tax Payable", type: "LIABILITY" },
      { code: "2.1.3", name: "Wages Payable", type: "LIABILITY" },
      { code: "2.1.4", name: "Accrued Expenses", type: "LIABILITY" },
      { code: "2.2", name: "Long-Term Liabilities", type: "LIABILITY" },
      { code: "2.2.1", name: "Bank Loans", type: "LIABILITY" },
      { code: "2.2.2", name: "Notes Payable", type: "LIABILITY" },
    ],
  },
  {
    code: "3",
    name: "Equity",
    type: "EQUITY",
    children: [
      { code: "3.1", name: "Owner's Capital", type: "EQUITY" },
      { code: "3.2", name: "Retained Earnings", type: "EQUITY" },
      { code: "3.3", name: "Current Year Earnings", type: "EQUITY" },
      { code: "3.4", name: "Drawings", type: "EQUITY" },
    ],
  },
  {
    code: "4",
    name: "Income",
    type: "INCOME",
    children: [
      { code: "4.1", name: "Sales Revenue", type: "INCOME" },
      { code: "4.1.1", name: "Product Sales", type: "INCOME" },
      { code: "4.1.2", name: "Service Revenue", type: "INCOME" },
      { code: "4.2", name: "Other Income", type: "INCOME" },
      { code: "4.2.1", name: "Discount Received", type: "INCOME" },
      { code: "4.2.2", name: "Interest Income", type: "INCOME" },
    ],
  },
  {
    code: "5",
    name: "Expenses",
    type: "EXPENSE",
    children: [
      { code: "5.1", name: "Cost of Goods Sold", type: "EXPENSE" },
      { code: "5.1.1", name: "COGS - Product", type: "EXPENSE" },
      { code: "5.1.2", name: "COGS - Service", type: "EXPENSE" },
      { code: "5.2", name: "Operating Expenses", type: "EXPENSE" },
      { code: "5.2.1", name: "Salaries & Wages", type: "EXPENSE" },
      { code: "5.2.2", name: "Rent Expense", type: "EXPENSE" },
      { code: "5.2.3", name: "Utilities", type: "EXPENSE" },
      { code: "5.2.4", name: "Office Supplies", type: "EXPENSE" },
      { code: "5.2.5", name: "Marketing & Advertising", type: "EXPENSE" },
      { code: "5.2.6", name: "Travel & Entertainment", type: "EXPENSE" },
      { code: "5.2.7", name: "Depreciation Expense", type: "EXPENSE" },
      { code: "5.2.8", name: "Insurance", type: "EXPENSE" },
      { code: "5.2.9", name: "Professional Fees", type: "EXPENSE" },
      { code: "5.3", name: "Financial Charges", type: "EXPENSE" },
      { code: "5.3.1", name: "Bank Charges", type: "EXPENSE" },
      { code: "5.3.2", name: "Interest Expense", type: "EXPENSE" },
      { code: "5.3.3", name: "Tax Expense", type: "EXPENSE" },
    ],
  },
];

export async function seedDefaultAccounts(companyId: string) {
  const existing = await prisma.coaAccount.findFirst({ where: { companyId } });
  if (existing) return;
  for (const group of DEFAULT_ACCOUNTS) {
    const parent = await prisma.coaAccount.create({
      data: { code: group.code, name: group.name, type: group.type, companyId },
    });
    if (group.children) {
      for (const child of group.children) {
        await prisma.coaAccount.create({
          data: {
            code: child.code,
            name: child.name,
            type: child.type,
            parentId: parent.id,
            companyId,
          },
        });
      }
    }
  }
}

export function getAccountNormalSide(type: AccountType): "debit" | "credit" {
  switch (type) {
    case "ASSET":
    case "EXPENSE":
    case "CONTRA_ASSET":
    case "CONTRA_LIABILITY":
    case "CONTRA_INCOME":
      return "debit";
    case "CONTRA_EXPENSE":
      return "credit";
    case "LIABILITY":
    case "EQUITY":
    case "INCOME":
      return "credit";
  }
}

export function getAccountBalance(debit: number, credit: number, type: AccountType): number {
  const normal = getAccountNormalSide(type);
  const balance = normal === "debit" ? debit - credit : credit - debit;
  return Math.round(balance * 100) / 100;
}

export async function getAccountBalances(companyId: string, dateFrom?: Date, dateTo?: Date) {
  const accounts = await prisma.coaAccount.findMany({
    where: { companyId, isActive: true },
    include: {
      journalLines: {
        where: {
          ...(dateFrom || dateTo
            ? {
                journalEntry: {
                  ...(dateFrom ? { date: { gte: dateFrom } } : {}),
                  ...(dateTo ? { date: { lte: dateTo } } : {}),
                  isPosted: true,
                },
              }
            : { journalEntry: { isPosted: true } }),
        },
      },
    },
  });
  return accounts.map((a) => {
    const debit = Number(a.journalLines.reduce((s, l) => s + Number(l.debit), 0));
    const credit = Number(a.journalLines.reduce((s, l) => s + Number(l.credit), 0));
    return { ...a, debit, credit, balance: getAccountBalance(debit, credit, a.type) };
  });
}

export async function getNextJournalNumber(
  companyId: string,
  journalType: JournalType,
): Promise<string> {
  const prefix =
    journalType === "GENERAL"
      ? "GL"
      : journalType === "SALES"
        ? "GL-INV"
        : journalType === "PURCHASES"
          ? "GL-BIL"
          : journalType === "CASH"
            ? "GL-CSH"
            : journalType === "BANK"
              ? "GL-BNK"
              : journalType === "RECEIPT"
                ? "GL-RCT"
                : journalType === "SALARY"
                  ? "GL-SAL"
                  : "GL-PYT";
  const last = await prisma.journalEntryMaster.findFirst({
    where: { companyId, journalType },
    orderBy: { number: "desc" },
  });
  const seq = last ? parseInt(last.number.split("-").at(-1) || "0", 10) + 1 : 1;
  return `${prefix}-${String(seq).padStart(5, "0")}`;
}

export async function postJournalEntry(params: {
  companyId: string;
  userId: string;
  date: Date;
  description: string;
  journalType: JournalType;
  lines: {
    accountId: string;
    debit: number;
    credit: number;
    partnerId?: string;
    description?: string;
  }[];
  reference?: string;
}) {
  const accountIds = Array.from(new Set(params.lines.map((line) => line.accountId)));
  const accountCount = await prisma.coaAccount.count({
    where: { id: { in: accountIds }, companyId: params.companyId, isActive: true },
  });
  if (accountCount !== accountIds.length) {
    throw new Error("One or more journal accounts do not belong to this company");
  }
  const number = await getNextJournalNumber(params.companyId, params.journalType);
  const totalDebit = Math.round(params.lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
  const totalCredit = Math.round(params.lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`);
  }
  return prisma.journalEntryMaster.create({
    data: {
      number,
      date: params.date,
      description: params.description,
      reference: params.reference,
      journalType: params.journalType,
      companyId: params.companyId,
      createdById: params.userId,
      isPosted: true,
      postedAt: new Date(),
      lines: {
        create: params.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          partnerId: l.partnerId,
          description: l.description,
        })),
      },
    },
    include: { lines: { include: { account: true } } },
  });
}
