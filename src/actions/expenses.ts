"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, requirePermission } from "@/lib/auth-helper";
import { createAuditLog, createNotification } from "@/lib/audit";
import { sendPushNotificationWithAdmins } from "@/lib/push";
import { PERMISSIONS } from "@/lib/constants";
import { deleteOperationalJournal, postExpenseJournal } from "@/lib/operational-journals";

function toNumber(value: unknown): number {
  return Number(value) || 0;
}

function expenseToPlain(expense: any) {
  return {
    id: expense.id,
    companyId: expense.companyId,
    employeeId: expense.employeeId,
    employee: expense.employee,
    category: expense.category,
    description: expense.description,
    amount: toNumber(expense.amount),
    expenseDate: expense.expenseDate,
    paidBy: expense.paidBy,
    status: expense.status,
    receiptUrl: expense.receiptUrl,
    notes: expense.notes,
    approvedById: expense.approvedById,
    approvedBy: expense.approvedBy,
    approvedAt: expense.approvedAt,
    reimbursedAt: expense.reimbursedAt,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

export async function getExpenses(mode: "mine" | "approval" = "mine") {
  const user = await requireCompanyAuth();
  const where: Record<string, unknown> = { companyId: user.companyId };

  if (mode === "mine") {
    where.employeeId = user.id;
  } else {
    await requirePermission(PERMISSIONS.EXPENSES_APPROVE);
  }

  const expenses = await prisma.expense.findMany({
    where: where as any,
    include: {
      employee: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { expenseDate: "desc" }],
  });

  const data = expenses.map(expenseToPlain);
  const summary = {
    toSubmit: data.filter((expense) => expense.status === "DRAFT").reduce((sum, expense) => sum + expense.amount, 0),
    underValidation: data.filter((expense) => expense.status === "SUBMITTED").reduce((sum, expense) => sum + expense.amount, 0),
    toReimburse: data.filter((expense) => expense.status === "APPROVED").reduce((sum, expense) => sum + expense.amount, 0),
    total: data.reduce((sum, expense) => sum + expense.amount, 0),
  };

  return { data, summary };
}

export async function createExpense(data: {
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  paidBy: string;
  receiptUrl?: string;
  notes?: string;
}) {
  const user = await requireCompanyAuth();

  if (!data.description.trim()) throw new Error("Description is required");
  if (!data.category.trim()) throw new Error("Category is required");
  if (data.amount <= 0) throw new Error("Expense amount must be positive");

  const expense = await prisma.expense.create({
    data: {
      companyId: user.companyId,
      employeeId: user.id,
      category: data.category,
      description: data.description,
      amount: data.amount,
      expenseDate: new Date(data.expenseDate),
      paidBy: data.paidBy || "EMPLOYEE",
      status: "SUBMITTED",
      receiptUrl: data.receiptUrl || null,
      notes: data.notes || null,
    },
  });

  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "CREATE",
    entity: "Expense",
    entityId: expense.id,
    metadata: { amount: data.amount, category: data.category, status: "SUBMITTED" },
  });

  await createNotification({
    companyId: user.companyId,
    userId: user.id,
    title: "Expense Submitted",
    message: `Rs ${data.amount} expense in ${data.category} — ${data.description}`,
    type: "INFO",
  });
  await sendPushNotificationWithAdmins(user.companyId, user.id, {
    title: "Expense Submitted",
    body: `Rs ${data.amount} — ${data.category} — ${data.description} — by ${user.name || user.id}`,
    url: "/expenses",
  });

  revalidatePath("/expenses");
  revalidatePath("/accounting/expenses");
  return expenseToPlain(expense);
}

export async function updateExpenseStatus(expenseId: string, status: "APPROVED" | "REJECTED" | "PAID", notes?: string) {
  const user = await requireCompanyAuth();
  await requirePermission(PERMISSIONS.EXPENSES_APPROVE);

  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, companyId: user.companyId },
  });
  if (!existing) throw new Error("Expense not found");

  const expense = await prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status,
        notes: notes || existing.notes,
        approvedById: status === "APPROVED" || status === "PAID" ? user.id : existing.approvedById,
        approvedAt: status === "APPROVED" || status === "PAID" ? new Date() : existing.approvedAt,
        reimbursedAt: status === "PAID" ? new Date() : existing.reimbursedAt,
      },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await deleteOperationalJournal(tx, user.companyId, `EXPENSE:${expenseId}`);
    if (status === "APPROVED" || status === "PAID") {
      await postExpenseJournal(tx, {
        companyId: user.companyId,
        userId: user.id,
        expenseId,
        description: updated.description,
        amount: toNumber(updated.amount),
        status,
        paidBy: updated.paidBy,
        date: updated.expenseDate,
      });
    }

    return updated;
  });

  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "UPDATE",
    entity: "Expense",
    entityId: expense.id,
    metadata: { status, amount: toNumber(expense.amount) },
  });

  await createNotification({
    companyId: user.companyId,
    userId: user.id,
    title: `Expense ${status}`,
    message: `Expense ${expense.description} ${status.toLowerCase()} — Rs ${toNumber(expense.amount)}`,
    type: status === "APPROVED" ? "SUCCESS" : status === "REJECTED" ? "WARNING" : "INFO",
  });
  await sendPushNotificationWithAdmins(user.companyId, user.id, {
    title: `Expense ${status}`,
    body: `Expense ${expense.description} — Rs ${toNumber(expense.amount)} — ${status.toLowerCase()} by ${user.name || user.id}`,
    url: "/expenses",
  });

  revalidatePath("/expenses");
  revalidatePath("/accounting/expenses");
  return expenseToPlain(expense);
}
