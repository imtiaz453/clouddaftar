"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, requirePermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";

function toNumber(value: unknown) {
  return Number(value) || 0;
}

function roleTitle(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function daysBetween(from: Date, to = new Date()) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export async function getEmployeesOverview() {
  const user = await requireCompanyAuth();
  await requirePermission(PERMISSIONS.EMPLOYEES_VIEW);

  const [members, employeeRecords, branches, expenseSummary, employeeContracts] = await Promise.all(
    [
      prisma.companyMembership.findMany({
        where: { companyId: user.companyId, isActive: true },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, image: true, isActive: true },
          },
          branch: { select: { id: true, name: true, code: true, city: true } },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      }),
      prisma.employeeRecord.findMany({
        where: { companyId: user.companyId, isActive: true, userId: null },
        include: { branch: { select: { id: true, name: true, code: true, city: true } } },
        orderBy: [{ joinedAt: "asc" }, { name: "asc" }],
      }),
      prisma.branch.findMany({
        where: { companyId: user.companyId, deletedAt: null, isActive: true },
        select: { id: true, name: true, code: true, city: true },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
      prisma.expense.groupBy({
        by: ["employeeId", "status"],
        where: { companyId: user.companyId },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.contract.findMany({
        where: { companyId: user.companyId },
        include: { employee: { select: { id: true, name: true } } },
        orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
      }),
    ],
  );

  const expenseByEmployee = new Map<
    string,
    { claims: number; amount: number; toReimburse: number }
  >();
  for (const row of expenseSummary) {
    const current = expenseByEmployee.get(row.employeeId) || {
      claims: 0,
      amount: 0,
      toReimburse: 0,
    };
    const amount = toNumber(row._sum.amount);
    current.claims += row._count.id;
    current.amount += amount;
    if (row.status === "APPROVED") current.toReimburse += amount;
    expenseByEmployee.set(row.employeeId, current);
  }

  const systemEmployees = members.map((member) => ({
    id: member.user.id,
    membershipId: member.id,
    recordId: null as string | null,
    hasSystemAccess: true,
    name: member.user.name,
    email: member.user.email,
    phone: member.user.phone,
    image: member.user.image,
    role: member.role,
    branch: member.branch,
    branchId: member.branchId,
    isActive: member.user.isActive,
    joinedAt: member.joinedAt,
    jobTitle: roleTitle(member.role),
    workEmail: member.user.email,
    workPhone: member.user.phone,
    manager: member.role === "OWNER" ? "Company leadership" : "Role manager",
    workLocation: member.branch?.name || "Company-wide",
    tenureDays: daysBetween(member.joinedAt),
    expenses: expenseByEmployee.get(member.user.id) || { claims: 0, amount: 0, toReimburse: 0 },
    profileCompleteness:
      40 +
      (member.user.name ? 15 : 0) +
      (member.user.phone ? 15 : 0) +
      (member.branchId ? 15 : 0) +
      (member.user.image ? 15 : 0),
    permissionMode:
      member.permissionOverrides &&
      typeof member.permissionOverrides === "object" &&
      !Array.isArray(member.permissionOverrides) &&
      (member.permissionOverrides as Record<string, unknown>).mode === "custom"
        ? "custom"
        : "role",
  }));

  const nonLoginEmployees = employeeRecords.map((employee) => ({
    id: employee.id,
    membershipId: employee.id,
    recordId: employee.id,
    hasSystemAccess: false,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    image: null,
    role: "EMPLOYEE",
    branch: employee.branch,
    branchId: employee.branchId,
    isActive: employee.isActive,
    joinedAt: employee.joinedAt,
    jobTitle: employee.jobTitle || roleTitle(employee.employmentType),
    workEmail: employee.email,
    workPhone: employee.phone,
    manager: "Not assigned",
    workLocation: employee.department || employee.branch?.name || "Company-wide",
    tenureDays: daysBetween(employee.joinedAt),
    expenses: { claims: 0, amount: 0, toReimburse: 0 },
    profileCompleteness:
      35 +
      (employee.name ? 20 : 0) +
      (employee.phone ? 15 : 0) +
      (employee.email ? 10 : 0) +
      (employee.branchId ? 10 : 0) +
      (employee.jobTitle ? 10 : 0),
    permissionMode: "none",
  }));

  const employees = [...systemEmployees, ...nonLoginEmployees];

  const departments = branches.map((branch) => {
    const team = employees.filter((employee) => employee.branchId === branch.id);
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      city: branch.city,
      manager: team.find((employee) => employee.role === "MANAGER")?.name || "Not assigned",
      employees: team.length,
      active: team.filter((employee) => employee.isActive).length,
    };
  });

  const unassignedEmployees = employees.filter((employee) => !employee.branchId).length;
  if (unassignedEmployees > 0) {
    departments.push({
      id: "company-wide",
      name: "Company-wide / Unassigned",
      code: "ALL",
      city: null,
      manager:
        employees.find((employee) => employee.role === "OWNER")?.name || "Company leadership",
      employees: unassignedEmployees,
      active: employees.filter((employee) => !employee.branchId && employee.isActive).length,
    });
  }

  const contractByEmployee = new Map<string, (typeof employeeContracts)[number]>();
  for (const contract of employeeContracts) {
    if (!contractByEmployee.has(contract.employeeId))
      contractByEmployee.set(contract.employeeId, contract);
  }

  const contracts = employees.map((employee) => {
    const contract = contractByEmployee.get(employee.id);
    return {
      employeeId: employee.id,
      employeeName: employee.name || "Unnamed employee",
      jobTitle: employee.jobTitle,
      department: employee.workLocation,
      startDate: contract?.startDate || employee.joinedAt,
      schedule: contract?.schedule || "Missing contract schedule",
      status: contract ? (contract.isActive ? "RUNNING" : "CLOSED") : "MISSING",
      structure: contract?.structure || "Missing salary structure",
      readiness:
        contract && employee.branchId && employee.phone
          ? "Ready"
          : contract
            ? "Needs HR data"
            : "Needs contract",
    };
  });

  const onboarding = [
    {
      step: "Create employee profile",
      complete: employees.length,
      total: employees.length,
    },
    {
      step: "Assign department or branch",
      complete: employees.filter((employee) => employee.branchId).length,
      total: employees.length,
    },
    {
      step: "Add work contact",
      complete: employees.filter((employee) => employee.phone).length,
      total: employees.length,
    },
    {
      step: "Review access policy",
      complete: employees.filter((employee) => employee.permissionMode === "custom").length,
      total: employees.length,
    },
  ];

  const averageTenure =
    employees.length > 0
      ? Math.round(
          employees.reduce((sum, employee) => sum + employee.tenureDays, 0) / employees.length,
        )
      : 0;

  return {
    employees,
    branches,
    departments,
    contracts,
    onboarding,
    summary: {
      total: employees.length,
      active: employees.filter((employee) => employee.isActive).length,
      branchAssigned: employees.filter((employee) => employee.branchId).length,
      customAccess: employees.filter((employee) => employee.permissionMode === "custom").length,
      departments: departments.length,
      averageTenure,
      profilesComplete: employees.filter((employee) => employee.profileCompleteness >= 85).length,
      reimbursementsDue: employees.reduce(
        (sum, employee) => sum + employee.expenses.toReimburse,
        0,
      ),
    },
  };
}

export async function getPayrollOverview() {
  const user = await requireCompanyAuth();
  await requirePermission(PERMISSIONS.PAYROLL_VIEW);

  const [members, draftExpenses, submittedExpenses, approvedExpenses, paidExpenses] =
    await Promise.all([
      prisma.companyMembership.findMany({
        where: { companyId: user.companyId, isActive: true, user: { isActive: true } },
        include: {
          user: { select: { id: true, name: true, email: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      }),
      prisma.expense.groupBy({
        by: ["employeeId"],
        where: { companyId: user.companyId, status: "DRAFT" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.groupBy({
        by: ["employeeId"],
        where: { companyId: user.companyId, status: "SUBMITTED" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.groupBy({
        by: ["employeeId"],
        where: { companyId: user.companyId, status: "APPROVED" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.groupBy({
        by: ["employeeId"],
        where: { companyId: user.companyId, status: "PAID" },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

  type ExpenseRollup = { amount: number; count: number };
  type ExpenseGroupRow = { employeeId: string; _sum: { amount: unknown }; _count: { id: number } };
  const toExpenseMap = (rows: ExpenseGroupRow[]) => new Map<string, ExpenseRollup>(
    rows.map((row) => [
      row.employeeId,
      { amount: toNumber(row._sum.amount), count: row._count.id },
    ]),
  );

  const draftByEmployee = toExpenseMap(draftExpenses as ExpenseGroupRow[]);
  const submittedByEmployee = toExpenseMap(submittedExpenses as ExpenseGroupRow[]);
  const approvedByEmployee = toExpenseMap(approvedExpenses as ExpenseGroupRow[]);
  const paidByEmployee = toExpenseMap(paidExpenses as ExpenseGroupRow[]);

  /* legacy inline maps replaced by typed toExpenseMap */
  const rows = members.map((member) => {
    const draft = draftByEmployee.get(member.userId) || { amount: 0, count: 0 };
    const submitted = submittedByEmployee.get(member.userId) || { amount: 0, count: 0 };
    const approved = approvedByEmployee.get(member.userId) || { amount: 0, count: 0 };
    const paid = paidByEmployee.get(member.userId) || { amount: 0, count: 0 };
    const contractStatus = member.branchId ? "RUNNING" : "NEEDS_WORK_LOCATION";
    const workDays = 22;
    const leaveDays = 0;
    return {
      employeeId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      jobTitle: roleTitle(member.role),
      branch: member.branch,
      contractStatus,
      structure:
        member.role === "CASHIER" || member.role === "STAFF"
          ? "Monthly Worker"
          : "Monthly Employee",
      workDays,
      workHours: workDays * 8,
      leaveDays,
      draftClaims: draft.count,
      submittedClaims: submitted.count,
      submittedAmount: submitted.amount,
      reimbursableAmount: approved.amount,
      reimbursableClaims: approved.count,
      reimbursedAmount: paid.amount,
      reimbursedClaims: paid.count,
      payrollStatus:
        approved.amount > 0
          ? "TO_REIMBURSE"
          : submitted.amount > 0
            ? "WAITING_APPROVAL"
            : contractStatus === "RUNNING"
              ? "READY"
              : "NEEDS_CONTRACT_DATA",
    };
  });

  const payslips = rows.map((row) => ({
    reference: `SLIP-${new Date().getFullYear()}-${row.employeeId.slice(-4).toUpperCase()}`,
    employeeId: row.employeeId,
    employeeName: row.name || "Unnamed employee",
    batch: "Current month",
    structure: row.structure,
    workedDays: row.workDays,
    gross: row.reimbursableAmount,
    net: row.reimbursableAmount,
    status:
      row.reimbursableAmount > 0
        ? "TO PAY"
        : row.submittedAmount > 0
          ? "WAITING"
          : row.contractStatus === "RUNNING"
            ? "READY"
            : "BLOCKED",
  }));

  const batches = [
    {
      name: "Current month payroll",
      period: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      employees: rows.length,
      toPay: rows.reduce((sum, row) => sum + row.reimbursableAmount, 0),
      status: rows.some((row) => row.reimbursableAmount > 0) ? "To pay" : "Ready",
    },
    {
      name: "Expense reimbursements",
      period: "Approved claims",
      employees: rows.filter((row) => row.reimbursableClaims > 0).length,
      toPay: rows.reduce((sum, row) => sum + row.reimbursableAmount, 0),
      status: approvedExpenses.length > 0 ? "Needs payment" : "Clear",
    },
  ];

  const salaryRules = [
    {
      code: "BASIC",
      name: "Basic Salary",
      category: "Gross",
      sequence: 100,
      condition: "Running contract",
    },
    {
      code: "ALW",
      name: "Allowances",
      category: "Gross",
      sequence: 150,
      condition: "Contract inputs",
    },
    {
      code: "DED",
      name: "Deductions",
      category: "Deduction",
      sequence: 200,
      condition: "Approved deductions",
    },
    {
      code: "EXP",
      name: "Expense Reimbursement",
      category: "Net",
      sequence: 250,
      condition: "Approved expenses",
    },
    {
      code: "NET",
      name: "Net Salary",
      category: "Net",
      sequence: 300,
      condition: "Gross - deductions + reimbursements",
    },
  ];

  const workEntries = rows.map((row) => ({
    employeeId: row.employeeId,
    employeeName: row.name || "Unnamed employee",
    source: row.contractStatus === "RUNNING" ? "Working Schedule" : "Missing contract data",
    type: "Attendance / Standard hours",
    days: row.workDays,
    hours: row.workHours,
    conflicts: row.contractStatus === "RUNNING" ? 0 : 1,
  }));

  return {
    rows,
    payslips,
    batches,
    salaryRules,
    workEntries,
    summary: {
      employees: rows.length,
      readyEmployees: rows.filter((row) => row.payrollStatus === "READY").length,
      waitingApproval: rows.reduce((sum, row) => sum + row.submittedClaims, 0),
      toReimburse: rows.reduce((sum, row) => sum + row.reimbursableAmount, 0),
      claimsToReimburse: rows.reduce((sum, row) => sum + row.reimbursableClaims, 0),
      reimbursed: rows.reduce((sum, row) => sum + row.reimbursedAmount, 0),
      workEntryConflicts: workEntries.reduce((sum, row) => sum + row.conflicts, 0),
    },
  };
}
