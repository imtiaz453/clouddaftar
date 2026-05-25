"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { postJournalEntry } from "@/lib/coa-accounting";

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function ensureCompanyEmployee(employeeId: string, companyId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: { userId: employeeId, companyId, isActive: true, user: { isActive: true } },
    select: { id: true },
  });
  if (!membership) throw new Error("Employee not found in this company");
}

async function assertAccountBelongsToCompany(
  accountId: string | null | undefined,
  companyId: string,
) {
  if (!accountId) return;
  const account = await prisma.coaAccount.findFirst({
    where: { id: accountId, companyId, isActive: true },
    select: { id: true },
  });
  if (!account) throw new Error("Account not found in this company");
}

async function payrollJournalExists(companyId: string, reference: string, description: string) {
  return prisma.journalEntryMaster.findFirst({
    where: { companyId, reference, description },
    select: { id: true },
  });
}

// ── Contracts ──

export async function getContracts(includeInactive = false) {
  const user = await requireCompanyAuth();
  return prisma.contract.findMany({
    where: { companyId: user.companyId, ...(includeInactive ? {} : { isActive: true }) },
    include: { employee: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { startDate: "desc" },
  });
}

export async function getPayrollEmployees() {
  const user = await requireCompanyAuth();
  const memberships = await prisma.companyMembership.findMany({
    where: { companyId: user.companyId, isActive: true, user: { isActive: true } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  return memberships.map((membership) => ({
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
  }));
}

export async function getContract(id: string) {
  const user = await requireCompanyAuth();
  return prisma.contract.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      employee: { select: { id: true, name: true, email: true, image: true } },
      payslips: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
}

export async function createContract(data: {
  employeeId: string;
  wageType: "MONTHLY" | "HOURLY" | "DAILY";
  wage: number;
  startDate: Date;
  endDate?: Date;
  schedule?: string;
  structure?: string;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  await ensureCompanyEmployee(data.employeeId, user.companyId);
  const startDate = toDate(data.startDate);
  const endDate = data.endDate ? toDate(data.endDate) : undefined;
  if (endDate && endDate < startDate) throw new Error("End date cannot be before start date");
  const contract = await prisma.contract.create({
    data: { ...data, startDate, endDate, companyId: user.companyId, wage: data.wage },
  });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "CREATE",
    entity: "Contract",
    entityId: contract.id,
    metadata: { employeeId: data.employeeId },
  });
  revalidatePath("/payroll");
  return contract;
}

export async function updateContract(
  id: string,
  data: Partial<{
    wageType: "MONTHLY" | "HOURLY" | "DAILY";
    wage: number;
    startDate: Date;
    endDate: Date | null;
    schedule: string;
    structure: string;
    isActive: boolean;
    notes: string;
  }>,
) {
  const user = await requireCompanyAuth();
  const existing = await prisma.contract.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) throw new Error("Contract not found");
  const payload: any = { ...data };
  if (payload.startDate) payload.startDate = toDate(payload.startDate);
  if (payload.endDate) payload.endDate = toDate(payload.endDate);
  if (payload.endDate && payload.startDate && payload.endDate < payload.startDate) {
    throw new Error("End date cannot be before start date");
  }
  const contract = await prisma.contract.update({ where: { id }, data: payload });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "UPDATE",
    entity: "Contract",
    entityId: id,
  });
  revalidatePath("/payroll");
  return contract;
}

// ── Salary Rules ──

export async function getSalaryRules() {
  const user = await requireCompanyAuth();
  return prisma.salaryRule.findMany({
    where: { companyId: user.companyId },
    orderBy: { sequence: "asc" },
    include: { account: { select: { id: true, code: true, name: true } } },
  });
}

export async function createSalaryRule(data: {
  code: string;
  name: string;
  category: "BASIC" | "ALLOWANCE" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION" | "NET";
  sequence: number;
  condition?: string;
  amountFixed: number;
  amountPercent: number;
  basedOn?: string;
  accountId?: string;
}) {
  const user = await requireCompanyAuth();
  await assertAccountBelongsToCompany(data.accountId, user.companyId);
  const rule = await prisma.salaryRule.create({ data: { ...data, companyId: user.companyId } });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "CREATE",
    entity: "SalaryRule",
    entityId: rule.id,
    metadata: { code: rule.code },
  });
  revalidatePath("/payroll");
  return rule;
}

export async function updateSalaryRule(
  id: string,
  data: Partial<{
    code: string;
    name: string;
    category: "BASIC" | "ALLOWANCE" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION" | "NET";
    sequence: number;
    condition: string;
    amountFixed: number;
    amountPercent: number;
    basedOn: string;
    accountId: string | null;
    isActive: boolean;
  }>,
) {
  const user = await requireCompanyAuth();
  const existing = await prisma.salaryRule.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) throw new Error("Salary rule not found");
  if (data.accountId !== undefined)
    await assertAccountBelongsToCompany(data.accountId, user.companyId);
  const rule = await prisma.salaryRule.update({ where: { id }, data });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "UPDATE",
    entity: "SalaryRule",
    entityId: id,
  });
  revalidatePath("/payroll");
  return rule;
}

export async function deleteSalaryRule(id: string) {
  const user = await requireCompanyAuth();
  const existing = await prisma.salaryRule.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) throw new Error("Salary rule not found");
  await prisma.salaryRule.delete({ where: { id } });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "DELETE",
    entity: "SalaryRule",
    entityId: id,
  });
  revalidatePath("/payroll");
}

// ── Payslips ──

export async function getPayslips(params?: {
  status?: string;
  employeeId?: string;
  batchId?: string;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireCompanyAuth();
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 50;
  const where: any = { companyId: user.companyId };
  if (params?.status) where.status = params.status;
  if (params?.employeeId) where.employeeId = params.employeeId;
  if (params?.batchId) where.batchId = params.batchId;
  const [data, total] = await Promise.all([
    prisma.payslip.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employee: { select: { id: true, name: true, image: true } },
        contract: { select: { wage: true, wageType: true } },
        batch: { select: { id: true, name: true, status: true } },
        lines: { orderBy: { sequence: "asc" } },
      },
    }),
    prisma.payslip.count({ where }),
  ]);
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getPayslip(id: string) {
  const user = await requireCompanyAuth();
  return prisma.payslip.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      employee: { select: { id: true, name: true, email: true, image: true } },
      contract: true,
      batch: { select: { id: true, name: true, status: true } },
      lines: {
        orderBy: { sequence: "asc" },
        include: { salaryRule: { select: { id: true, code: true } } },
      },
      adjustments: true,
    },
  });
}

async function computePayslipAmounts(
  employeeId: string,
  contractId: string,
  companyId: string,
  dateFrom: Date,
  dateTo: Date,
) {
  const contract = await prisma.contract.findFirst({ where: { id: contractId, companyId } });
  if (!contract) throw new Error("Contract not found");
  if (contract.employeeId !== employeeId)
    throw new Error("Contract does not belong to this employee");
  if (contract.startDate > dateTo || (contract.endDate && contract.endDate < dateFrom)) {
    throw new Error("Contract is not active in the payslip period");
  }

  const rules = await prisma.salaryRule.findMany({
    where: { companyId, isActive: true },
    orderBy: { sequence: "asc" },
  });
  const [adjustments, workEntries] = await Promise.all([
    prisma.salaryAdjustment.findMany({
      where: {
        employeeId,
        companyId,
        payslipId: null,
        date: { gte: dateFrom, lte: dateTo },
      },
    }),
    prisma.workEntry.findMany({
      where: { employeeId, companyId, date: { gte: dateFrom, lte: dateTo } },
      orderBy: { date: "asc" },
    }),
  ]);

  const periodDays = Math.max(
    1,
    Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1,
  );
  const payableEntries = workEntries.filter(
    (entry) => !["ABSENT", "LEAVE"].includes(entry.workType || ""),
  );
  const payableHours = payableEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const payableDays = payableEntries.length || periodDays;
  const baseWage = roundMoney(
    contract.wageType === "HOURLY"
      ? Number(contract.wage) * payableHours
      : contract.wageType === "DAILY"
        ? Number(contract.wage) * payableDays
        : workEntries.length > 0
          ? (Number(contract.wage) / periodDays) * payableDays
          : Number(contract.wage),
  );
  const lines: {
    salaryRuleId?: string;
    code: string;
    name: string;
    category: string;
    amount: number;
    total: number;
    sequence: number;
  }[] = [];
  let grossPay = 0;
  let totalDeductions = 0;
  let employerCost = 0;
  const hasBasicRule = rules.some((rule) => rule.category === "BASIC");

  for (const rule of rules) {
    let amount = 0;
    const fixed = Number(rule.amountFixed);
    const pct = Number(rule.amountPercent);
    if (fixed > 0) {
      amount = fixed;
    } else if (pct > 0) {
      const baseValue = rule.basedOn === "contract.wage" ? baseWage : grossPay;
      amount = (baseValue * pct) / 100;
    }
    if (fixed > 0 && pct > 0) {
      const baseValue = rule.basedOn === "contract.wage" ? baseWage : grossPay;
      amount = fixed + (baseValue * pct) / 100;
    }
    const total = roundMoney(amount);
    if (total !== 0) {
      lines.push({
        salaryRuleId: rule.id,
        code: rule.code,
        name: rule.name,
        category: rule.category,
        amount,
        total,
        sequence: rule.sequence,
      });
    }
    if (rule.category === "BASIC" || rule.category === "ALLOWANCE") {
      grossPay += total;
    } else if (rule.category === "DEDUCTION") {
      totalDeductions += total;
    } else if (rule.category === "EMPLOYER_CONTRIBUTION") {
      employerCost += total;
    }
  }

  if (!hasBasicRule && baseWage > 0) {
    lines.unshift({
      code: "BASIC",
      name: "Basic Salary",
      category: "BASIC",
      amount: baseWage,
      total: baseWage,
      sequence: 1,
    });
    grossPay += baseWage;
  }

  for (const adj of adjustments) {
    const total = Number(adj.amount);
    lines.push({
      code: adj.name,
      name: adj.name,
      category: adj.type,
      amount: total,
      total,
      sequence: 999,
    });
    if (adj.type === "ALLOWANCE" || adj.type === "BASIC") grossPay += total;
    else if (adj.type === "DEDUCTION") totalDeductions += total;
  }

  grossPay = roundMoney(grossPay);
  totalDeductions = roundMoney(totalDeductions);
  employerCost = roundMoney(employerCost);
  const netPay = roundMoney(grossPay - totalDeductions);

  if (netPay === 0 && lines.length === 0) {
    lines.push({
      code: "NET",
      name: "Net Pay",
      category: "NET",
      amount: baseWage,
      total: baseWage,
      sequence: 999,
    });
    grossPay = baseWage;
  }

  return {
    lines,
    grossPay,
    totalDeductions,
    netPay,
    employerCost,
    adjustmentIds: adjustments.map((adjustment) => adjustment.id),
  };
}

export async function draftPayslip(data: {
  employeeId: string;
  contractId: string;
  dateFrom: Date;
  dateTo: Date;
  batchId?: string;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  await ensureCompanyEmployee(data.employeeId, user.companyId);
  const dateFrom = toDate(data.dateFrom);
  const dateTo = toDate(data.dateTo);
  if (dateTo < dateFrom) throw new Error("Payslip end date cannot be before start date");
  if (data.batchId) {
    const batch = await prisma.payrollBatch.findFirst({
      where: { id: data.batchId, companyId: user.companyId },
    });
    if (!batch) throw new Error("Payroll batch not found");
  }
  const duplicate = await prisma.payslip.findFirst({
    where: {
      employeeId: data.employeeId,
      contractId: data.contractId,
      companyId: user.companyId,
      dateFrom,
      dateTo,
      status: { not: "CANCELLED" },
    },
    select: { number: true },
  });
  if (duplicate) throw new Error(`Payslip already exists for this period (${duplicate.number})`);
  const count = await prisma.payslip.count({ where: { companyId: user.companyId } });
  const number = `SLIP-${String(count + 1).padStart(4, "0")}`;

  const computed = await computePayslipAmounts(
    data.employeeId,
    data.contractId,
    user.companyId,
    dateFrom,
    dateTo,
  );

  const payslip = await prisma.payslip.create({
    data: {
      number,
      employeeId: data.employeeId,
      contractId: data.contractId,
      companyId: user.companyId,
      batchId: data.batchId,
      dateFrom,
      dateTo,
      grossPay: computed.grossPay,
      totalDeductions: computed.totalDeductions,
      netPay: computed.netPay,
      employerCost: computed.employerCost,
      notes: data.notes,
      lines: {
        create: computed.lines.map((l) => ({
          salaryRuleId: l.salaryRuleId,
          code: l.code,
          name: l.name,
          category: l.category as any,
          amount: l.amount,
          total: l.total,
          sequence: l.sequence,
        })),
      },
    },
    include: {
      lines: { orderBy: { sequence: "asc" } },
      employee: { select: { id: true, name: true } },
      contract: { select: { wage: true, wageType: true } },
    },
  });

  if (computed.adjustmentIds.length > 0) {
    await prisma.salaryAdjustment.updateMany({
      where: { id: { in: computed.adjustmentIds }, companyId: user.companyId, payslipId: null },
      data: { payslipId: payslip.id },
    });
  }

  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "CREATE",
    entity: "Payslip",
    entityId: payslip.id,
    metadata: { number },
  });
  revalidatePath("/payroll");
  return payslip;
}

export async function draftBatchPayslips(batchId: string) {
  const user = await requireCompanyAuth();
  const batch = await prisma.payrollBatch.findFirst({
    where: { id: batchId, companyId: user.companyId },
  });
  if (!batch) throw new Error("Batch not found");

  const contracts = await prisma.contract.findMany({
    where: { companyId: user.companyId, isActive: true },
    include: { employee: { select: { id: true, name: true } } },
  });

  const results: any[] = [];
  for (const contract of contracts) {
    try {
      const payslip = await draftPayslip({
        employeeId: contract.employeeId,
        contractId: contract.id,
        dateFrom: batch.dateFrom,
        dateTo: batch.dateTo,
        batchId: batch.id,
      });
      results.push({ employee: contract.employee.name, status: "ok", payslipId: payslip.id });
    } catch (e: any) {
      results.push({ employee: contract.employee.name, status: "error", error: e.message });
    }
  }
  revalidatePath("/payroll");
  return results;
}

async function getAccountByCode(companyId: string, code: string) {
  return prisma.coaAccount.findUnique({ where: { code_companyId: { code, companyId } } });
}

async function postPayslipAccrual(payslip: any, userId: string, companyId: string) {
  const salaryExpense = await getAccountByCode(companyId, "5.2.1");
  const wagesPayable = await getAccountByCode(companyId, "2.1.3");
  if (!salaryExpense || !wagesPayable) return null;

  const lines: {
    accountId: string;
    debit: number;
    credit: number;
    partnerId?: string;
    description?: string;
  }[] = [];
  const gross = Number(payslip.grossPay);
  const net = Number(payslip.netPay);
  const deductions = Number(payslip.totalDeductions);
  const employerCost = Number(payslip.employerCost);

  lines.push({
    accountId: salaryExpense.id,
    debit: gross,
    credit: 0,
    description: `Salary for ${payslip.number}`,
  });
  lines.push({
    accountId: wagesPayable.id,
    debit: 0,
    credit: net,
    partnerId: payslip.employeeId,
    description: "Net pay payable",
  });

  if (deductions > 0) {
    const otherLiability = await getAccountByCode(companyId, "2.1.4");
    lines.push({
      accountId: (otherLiability || wagesPayable).id,
      debit: 0,
      credit: deductions,
      description: "Payroll deductions payable",
    });
  }

  if (employerCost > 0) {
    const benefitExpense = await getAccountByCode(companyId, "5.2.1");
    lines.push({
      accountId: benefitExpense!.id,
      debit: employerCost,
      credit: 0,
      description: "Employer contributions",
    });
    const contribPayable = await getAccountByCode(companyId, "2.1.4");
    lines.push({
      accountId: (contribPayable || wagesPayable).id,
      debit: 0,
      credit: employerCost,
      description: "Employer contributions payable",
    });
  }

  const description = `Payroll accrual: ${payslip.number}`;
  const existing = await payrollJournalExists(companyId, payslip.number, description);
  if (existing) return existing;
  return postJournalEntry({
    companyId,
    userId,
    date: payslip.dateTo,
    description,
    journalType: "SALARY",
    lines,
    reference: payslip.number,
  });
}

async function postPayslipPayment(payslip: any, userId: string, companyId: string) {
  const wagesPayable = await getAccountByCode(companyId, "2.1.3");
  const bank = await getAccountByCode(companyId, "1.1.2");
  if (!wagesPayable || !bank) return null;

  const net = Number(payslip.netPay);
  const lines = [
    {
      accountId: wagesPayable.id,
      debit: net,
      credit: 0,
      partnerId: payslip.employeeId,
      description: `Salary payment: ${payslip.number}`,
    },
    { accountId: bank.id, debit: 0, credit: net, description: `Bank transfer: ${payslip.number}` },
  ];

  const description = `Salary payment: ${payslip.number}`;
  const existing = await payrollJournalExists(companyId, payslip.number, description);
  if (existing) return existing;
  return postJournalEntry({
    companyId,
    userId,
    date: new Date(),
    description,
    journalType: "PAYMENT",
    lines,
    reference: payslip.number,
  });
}

export async function updatePayslipStatus(
  id: string,
  status: "VERIFIED" | "APPROVED" | "PAID" | "CANCELLED",
) {
  const user = await requireCompanyAuth();
  const payslip = await prisma.payslip.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      lines: {
        where: { salaryRuleId: { not: null } },
        include: { salaryRule: { select: { accountId: true } } },
      },
    },
  });
  if (!payslip) throw new Error("Payslip not found");
  const allowed: Record<string, string[]> = {
    DRAFT: ["VERIFIED", "CANCELLED"],
    VERIFIED: ["APPROVED", "CANCELLED"],
    APPROVED: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  };
  if (!allowed[payslip.status]?.includes(status)) {
    throw new Error(`Cannot move payslip from ${payslip.status} to ${status}`);
  }

  const updated = await prisma.payslip.update({ where: { id }, data: { status } });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "UPDATE",
    entity: "Payslip",
    entityId: id,
    metadata: { status },
  });

  if (status === "APPROVED") {
    try {
      await postPayslipAccrual(payslip, user.id, user.companyId);
    } catch {}
  }

  if (status === "PAID") {
    try {
      await postPayslipPayment(payslip, user.id, user.companyId);
    } catch {}

    if (payslip.batchId) {
      const allPaid = await prisma.payslip.count({
        where: { batchId: payslip.batchId, companyId: user.companyId, status: { not: "PAID" } },
      });
      if (allPaid === 0) {
        await prisma.payrollBatch.update({
          where: { id: payslip.batchId },
          data: { status: "PAID" },
        });
      }
    }
  }
  revalidatePath("/payroll");
  return updated;
}

export async function deletePayslip(id: string) {
  const user = await requireCompanyAuth();
  const payslip = await prisma.payslip.findFirst({ where: { id, companyId: user.companyId } });
  if (!payslip) throw new Error("Payslip not found");
  if (payslip.status !== "DRAFT" && payslip.status !== "CANCELLED") {
    throw new Error("Only draft or cancelled payslips can be deleted");
  }
  await prisma.payslip.delete({ where: { id } });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "DELETE",
    entity: "Payslip",
    entityId: id,
  });
  revalidatePath("/payroll");
}

// ── Payroll Batches ──

export async function getBatches() {
  const user = await requireCompanyAuth();
  return prisma.payrollBatch.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { payslips: true } },
    },
  });
}

export async function createBatch(data: {
  name: string;
  dateFrom: Date;
  dateTo: Date;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  const dateFrom = toDate(data.dateFrom);
  const dateTo = toDate(data.dateTo);
  if (dateTo < dateFrom) throw new Error("Batch end date cannot be before start date");
  const batch = await prisma.payrollBatch.create({
    data: { ...data, dateFrom, dateTo, companyId: user.companyId, createdById: user.id },
  });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "CREATE",
    entity: "PayrollBatch",
    entityId: batch.id,
    metadata: { name: data.name },
  });
  revalidatePath("/payroll");
  return batch;
}

export async function updateBatchStatus(
  id: string,
  status: "VERIFIED" | "APPROVED" | "PAID" | "CANCELLED",
) {
  const user = await requireCompanyAuth();
  const currentBatch = await prisma.payrollBatch.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!currentBatch) throw new Error("Payroll batch not found");
  const allowed: Record<string, string[]> = {
    DRAFT: ["VERIFIED", "CANCELLED"],
    VERIFIED: ["APPROVED", "CANCELLED"],
    APPROVED: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  };
  if (!allowed[currentBatch.status]?.includes(status)) {
    throw new Error(`Cannot move batch from ${currentBatch.status} to ${status}`);
  }
  const batch = await prisma.payrollBatch.update({ where: { id }, data: { status } });

  const payslips = await prisma.payslip.findMany({
    where: { batchId: id, companyId: user.companyId },
  });

  if (status === "APPROVED" || status === "PAID") {
    await prisma.payslip.updateMany({
      where: { batchId: id, companyId: user.companyId },
      data: { status },
    });
    for (const ps of payslips) {
      try {
        if (status === "APPROVED") await postPayslipAccrual(ps, user.id, user.companyId);
        if (status === "PAID") await postPayslipPayment(ps, user.id, user.companyId);
      } catch {}
    }
  }
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "UPDATE",
    entity: "PayrollBatch",
    entityId: id,
    metadata: { status },
  });
  revalidatePath("/payroll");
  return batch;
}

export async function deleteBatch(id: string) {
  const user = await requireCompanyAuth();
  const batch = await prisma.payrollBatch.findFirst({ where: { id, companyId: user.companyId } });
  if (!batch) throw new Error("Payroll batch not found");
  if (batch.status !== "DRAFT" && batch.status !== "CANCELLED") {
    throw new Error("Only draft or cancelled batches can be deleted");
  }
  await prisma.payslip.deleteMany({ where: { batchId: id, companyId: user.companyId } });
  await prisma.payrollBatch.delete({ where: { id } });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "DELETE",
    entity: "PayrollBatch",
    entityId: id,
  });
  revalidatePath("/payroll");
}

// ── Work Entries ──

export async function getWorkEntries(params?: {
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const user = await requireCompanyAuth();
  const where: any = { companyId: user.companyId };
  if (params?.employeeId) where.employeeId = params.employeeId;
  if (params?.dateFrom || params?.dateTo) {
    where.date = {};
    if (params.dateFrom) where.date.gte = new Date(params.dateFrom);
    if (params.dateTo) where.date.lte = new Date(params.dateTo);
  }
  return prisma.workEntry.findMany({
    where,
    orderBy: { date: "desc" },
    include: { employee: { select: { id: true, name: true, image: true } } },
  });
}

export async function upsertWorkEntry(data: {
  employeeId: string;
  date: Date;
  workType?: string;
  hours?: number;
  dayRate?: number;
  leaveType?: string;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  await ensureCompanyEmployee(data.employeeId, user.companyId);
  const date = toDate(data.date);
  const existing = await prisma.workEntry.findUnique({
    where: { employeeId_date: { employeeId: data.employeeId, date } },
  });
  if (existing && existing.companyId !== user.companyId) throw new Error("Work entry not found");

  let entry;
  if (existing) {
    entry = await prisma.workEntry.update({
      where: { id: existing.id },
      data: {
        workType: data.workType,
        hours: data.hours,
        dayRate: data.dayRate,
        leaveType: data.leaveType,
        notes: data.notes,
      },
    });
  } else {
    entry = await prisma.workEntry.create({ data: { ...data, date, companyId: user.companyId } });
  }
  revalidatePath("/payroll");
  return entry;
}

export async function deleteWorkEntry(id: string) {
  const user = await requireCompanyAuth();
  const entry = await prisma.workEntry.findFirst({ where: { id, companyId: user.companyId } });
  if (!entry) throw new Error("Work entry not found");
  await prisma.workEntry.delete({ where: { id } });
  revalidatePath("/payroll");
}

// ── Salary Adjustments ──

export async function getSalaryAdjustments(params?: { employeeId?: string }) {
  const user = await requireCompanyAuth();
  const where: any = { companyId: user.companyId };
  if (params?.employeeId) where.employeeId = params.employeeId;
  return prisma.salaryAdjustment.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      employee: { select: { id: true, name: true, image: true } },
      payslip: { select: { id: true, number: true } },
    },
  });
}

export async function createSalaryAdjustment(data: {
  employeeId: string;
  name: string;
  type: "BASIC" | "ALLOWANCE" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION" | "NET";
  amount: number;
  date: Date;
  recurring?: boolean;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  await ensureCompanyEmployee(data.employeeId, user.companyId);
  const adj = await prisma.salaryAdjustment.create({
    data: { ...data, date: toDate(data.date), companyId: user.companyId },
  });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "CREATE",
    entity: "SalaryAdjustment",
    entityId: adj.id,
    metadata: { name: data.name },
  });
  revalidatePath("/payroll");
  return adj;
}

export async function deleteSalaryAdjustment(id: string) {
  const user = await requireCompanyAuth();
  const adjustment = await prisma.salaryAdjustment.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!adjustment) throw new Error("Salary adjustment not found");
  if (adjustment.payslipId)
    throw new Error("Cannot delete an adjustment already linked to a payslip");
  await prisma.salaryAdjustment.delete({ where: { id } });
  revalidatePath("/payroll");
}

// ── Reports ──

export async function getPayrollSummary(params?: { dateFrom?: string; dateTo?: string }) {
  const user = await requireCompanyAuth();
  const where: any = { companyId: user.companyId };
  if (params?.dateFrom) where.createdAt = { ...where.createdAt, gte: new Date(params.dateFrom) };
  if (params?.dateTo) where.createdAt = { ...where.createdAt, lte: new Date(params.dateTo) };

  const payslips = await prisma.payslip.findMany({ where });
  const totalGross = payslips.reduce((s, p) => s + Number(p.grossPay), 0);
  const totalDeductions = payslips.reduce((s, p) => s + Number(p.totalDeductions), 0);
  const totalNet = payslips.reduce((s, p) => s + Number(p.netPay), 0);
  const totalEmployerCost = payslips.reduce((s, p) => s + Number(p.employerCost), 0);

  return { payslips: payslips.length, totalGross, totalDeductions, totalNet, totalEmployerCost };
}

export async function getHeadcountReport() {
  const user = await requireCompanyAuth();
  const active = await prisma.contract.count({
    where: { companyId: user.companyId, isActive: true },
  });
  const total = await prisma.contract.count({ where: { companyId: user.companyId } });
  const memberships = await prisma.companyMembership.count({
    where: { companyId: user.companyId, user: { isActive: true } },
  });
  return { activeContracts: active, totalContracts: total, activeEmployees: memberships };
}

export async function getPayrollAnalysis() {
  const user = await requireCompanyAuth();
  const payslips = await prisma.payslip.findMany({
    where: { companyId: user.companyId },
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const totalByEmployee: Record<string, { name: string; count: number; total: number }> = {};
  for (const p of payslips) {
    const name = p.employee?.name || "Unknown";
    if (!totalByEmployee[p.employeeId])
      totalByEmployee[p.employeeId] = { name, count: 0, total: 0 };
    totalByEmployee[p.employeeId].count++;
    totalByEmployee[p.employeeId].total += Number(p.netPay);
  }
  return {
    payslips,
    totalByEmployee: Object.values(totalByEmployee).sort((a, b) => b.total - a.total),
  };
}
