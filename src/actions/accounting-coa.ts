"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createAuditLog } from "@/lib/audit";
import { seedDefaultAccounts, getAccountBalances } from "@/lib/coa-accounting";
import { ensureOperationalJournalsForCompany } from "@/lib/operational-journals";
import type { AccountType, JournalType } from "@prisma/client";

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

async function assertCoaAccount(companyId: string, accountId: string | null | undefined) {
  if (!accountId) return;
  const account = await prisma.coaAccount.findFirst({
    where: { id: accountId, companyId, isActive: true },
    select: { id: true },
  });
  if (!account) throw new Error("Account not found in this company");
}

async function prepareFinancialReportData(companyId: string, userId: string) {
  await seedDefaultAccounts(companyId);
  await prisma.$transaction((tx) => ensureOperationalJournalsForCompany(tx, { companyId, userId }));
}

// ── Chart of Accounts ──

export async function getAccounts() {
  const user = await requireCompanyAuth();
  await seedDefaultAccounts(user.companyId);
  return prisma.coaAccount.findMany({
    where: { companyId: user.companyId, isActive: true },
    orderBy: { code: "asc" },
  });
}

export async function createAccount(data: {
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  description?: string;
}) {
  const user = await requireCompanyAuth();
  await assertCoaAccount(user.companyId, data.parentId);
  const account = await prisma.coaAccount.create({
    data: { ...data, companyId: user.companyId },
  });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "CREATE",
    entity: "CoaAccount",
    entityId: account.id,
    metadata: { code: account.code, name: account.name },
  });
  return account;
}

export async function updateAccount(
  id: string,
  data: {
    code?: string;
    name?: string;
    type?: AccountType;
    parentId?: string | null;
    description?: string;
    isActive?: boolean;
  },
) {
  const user = await requireCompanyAuth();
  const existing = await prisma.coaAccount.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) throw new Error("Account not found");
  await assertCoaAccount(user.companyId, data.parentId);
  if (data.parentId === id) throw new Error("Account cannot be its own parent");
  const account = await prisma.coaAccount.update({ where: { id }, data });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "UPDATE",
    entity: "CoaAccount",
    entityId: account.id,
    metadata: { code: account.code, name: account.name },
  });
  return account;
}

export async function deleteAccount(id: string) {
  const user = await requireCompanyAuth();
  const existing = await prisma.coaAccount.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) throw new Error("Account not found");
  const lines = await prisma.journalEntryLine.count({
    where: { accountId: id, account: { companyId: user.companyId } },
  });
  if (lines > 0)
    throw new Error("Cannot delete account with journal entries. Deactivate it instead.");
  await prisma.coaAccount.update({ where: { id }, data: { isActive: false } });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "DELETE",
    entity: "CoaAccount",
    entityId: id,
  });
}

// ── Journal Entries ──

export async function getJournalEntries(params?: {
  journalType?: JournalType;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  await prepareFinancialReportData(user.companyId, user.id);
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 50;
  const where: any = { companyId: user.companyId };
  if (params?.journalType) where.journalType = params.journalType;
  const [data, total] = await Promise.all([
    prisma.journalEntryMaster.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        lines: { include: { account: { select: { code: true, name: true } } } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.journalEntryMaster.count({ where }),
  ]);
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getJournalEntry(id: string) {
  const user = await requireCompanyAuth();
  return prisma.journalEntryMaster.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      lines: { include: { account: { select: { code: true, name: true, type: true } } } },
      createdBy: { select: { name: true } },
    },
  });
}

export async function createJournalEntry(data: {
  date: Date;
  description: string;
  journalType: JournalType;
  reference?: string;
  lines: { accountId: string; debit: number; credit: number; description?: string }[];
}) {
  const user = await requireCompanyAuth();
  const { postJournalEntry, getNextJournalNumber } = await import("@/lib/coa-accounting");
  if (!data.lines || data.lines.length < 2)
    throw new Error("A journal entry needs at least two lines");
  await Promise.all(data.lines.map((line) => assertCoaAccount(user.companyId, line.accountId)));
  const number = await getNextJournalNumber(user.companyId, data.journalType);
  const totalDebit = Math.round(data.lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
  const totalCredit = Math.round(data.lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
  if (Math.abs(totalDebit - totalCredit) > 0.01)
    throw new Error(`Journal not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`);
  const entry = await prisma.journalEntryMaster.create({
    data: {
      number,
      date: data.date,
      description: data.description,
      reference: data.reference,
      journalType: data.journalType,
      companyId: user.companyId,
      createdById: user.id,
      isPosted: true,
      postedAt: new Date(),
      lines: {
        create: data.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        })),
      },
    },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
  });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "CREATE",
    entity: "JournalEntryMaster",
    entityId: entry.id,
    metadata: { number: entry.number },
  });
  return entry;
}

// ── Reports ──

export async function getGeneralLedger(params: {
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 50;
  const where: any = { account: { companyId: user.companyId } };
  if (params.accountId) where.accountId = params.accountId;
  if (params.dateFrom || params.dateTo) {
    where.journalEntry = { isPosted: true };
    if (params.dateFrom)
      where.journalEntry.date = {
        ...where.journalEntry.date,
        gte: parseLocalDay(params.dateFrom, "start"),
      };
    if (params.dateTo)
      where.journalEntry.date = {
        ...where.journalEntry.date,
        lte: parseLocalDay(params.dateTo, "end"),
      };
  } else {
    where.journalEntry = { isPosted: true };
  }
  const [data, total] = await Promise.all([
    prisma.journalEntryLine.findMany({
      where,
      orderBy: [{ journalEntry: { date: "asc" } }, { journalEntry: { number: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
        journalEntry: { select: { number: true, date: true, description: true, reference: true } },
      },
    }),
    prisma.journalEntryLine.count({ where }),
  ]);
  const accounts = await prisma.coaAccount.findMany({
    where: { companyId: user.companyId, isActive: true },
    orderBy: { code: "asc" },
  });
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize), accounts };
}

export async function getTrialBalance(dateFrom?: string, dateTo?: string) {
  const user = await requireCompanyAuth();
  await prepareFinancialReportData(user.companyId, user.id);
  const balances = await getAccountBalances(
    user.companyId,
    dateFrom ? parseLocalDay(dateFrom, "start") : undefined,
    dateTo ? parseLocalDay(dateTo, "end") : undefined,
  );
  const accounts = balances
    .map((account) => {
      const netDebit = Math.round((account.debit - account.credit) * 100) / 100;
      return {
        ...account,
        trialDebit: netDebit > 0 ? netDebit : 0,
        trialCredit: netDebit < 0 ? Math.abs(netDebit) : 0,
      };
    })
    .filter((account) => account.trialDebit !== 0 || account.trialCredit !== 0);
  const totalDebit = Math.round(accounts.reduce((s, a) => s + a.trialDebit, 0) * 100) / 100;
  const totalCredit = Math.round(accounts.reduce((s, a) => s + a.trialCredit, 0) * 100) / 100;
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  return {
    accounts,
    totalDebit,
    totalCredit,
    difference,
    isBalanced: Math.abs(difference) <= 0.01,
  };
}

export async function getBalanceSheet(dateAsOf?: string) {
  const user = await requireCompanyAuth();
  await prepareFinancialReportData(user.companyId, user.id);
  const asOf = dateAsOf ? parseLocalDay(dateAsOf, "end") : new Date();
  const balances = await getAccountBalances(user.companyId, undefined, asOf);
  const assets = balances
    .filter((a) => a.type === "ASSET" || a.type === "CONTRA_ASSET")
    .reduce((s, a) => s + a.balance, 0);
  const liabilities = balances
    .filter((a) => a.type === "LIABILITY" || a.type === "CONTRA_LIABILITY")
    .reduce((s, a) => s + a.balance, 0);
  const equity = balances.filter((a) => a.type === "EQUITY").reduce((s, a) => s + a.balance, 0);
  const income = balances
    .filter((a) => a.type === "INCOME" || a.type === "CONTRA_INCOME")
    .reduce((s, a) => s + a.balance, 0);
  const expenses = balances
    .filter((a) => a.type === "EXPENSE" || a.type === "CONTRA_EXPENSE")
    .reduce((s, a) => s + a.balance, 0);
  const netIncome = income - expenses;
  const totalEquity = equity + netIncome;
  return {
    assets: balances.filter((a) => a.type === "ASSET" || a.type === "CONTRA_ASSET"),
    liabilities: balances.filter((a) => a.type === "LIABILITY" || a.type === "CONTRA_LIABILITY"),
    equity: balances.filter((a) => a.type === "EQUITY"),
    income: balances.filter((a) => a.type === "INCOME" || a.type === "CONTRA_INCOME"),
    expenses: balances.filter((a) => a.type === "EXPENSE" || a.type === "CONTRA_EXPENSE"),
    totalAssets: Math.round(assets * 100) / 100,
    totalLiabilities: Math.round(liabilities * 100) / 100,
    totalEquity: Math.round(totalEquity * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
    totalLiabilitiesEquity: Math.round((liabilities + totalEquity) * 100) / 100,
  };
}

export async function getProfitLoss(dateFrom?: string, dateTo?: string) {
  const user = await requireCompanyAuth();
  await prepareFinancialReportData(user.companyId, user.id);
  const balances = await getAccountBalances(
    user.companyId,
    dateFrom ? parseLocalDay(dateFrom, "start") : undefined,
    dateTo ? parseLocalDay(dateTo, "end") : undefined,
  );
  const income = balances.filter((a) => a.type === "INCOME" || a.type === "CONTRA_INCOME");
  const expenses = balances.filter((a) => a.type === "EXPENSE" || a.type === "CONTRA_EXPENSE");
  const totalIncome = Math.round(income.reduce((s, a) => s + a.balance, 0) * 100) / 100;
  const totalExpenses = Math.round(expenses.reduce((s, a) => s + a.balance, 0) * 100) / 100;
  return { income, expenses, totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses };
}

export async function getDayBook(dateFrom?: string, dateTo?: string, journalType?: string) {
  const user = await requireCompanyAuth();
  await prepareFinancialReportData(user.companyId, user.id);
  const where: any = { companyId: user.companyId, isPosted: true };
  if (dateFrom) where.date = { ...where.date, gte: parseLocalDay(dateFrom, "start") };
  if (dateTo) where.date = { ...where.date, lte: parseLocalDay(dateTo, "end") };
  if (journalType) where.journalType = journalType;
  return prisma.journalEntryMaster.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      lines: { include: { account: { select: { code: true, name: true } } } },
      createdBy: { select: { name: true } },
    },
  });
}
