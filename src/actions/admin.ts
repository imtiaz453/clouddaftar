"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  createAdminSession,
  destroyAdminSession,
  requireAdmin,
  getCurrentAdmin,
  logAdminAction,
} from "@/lib/admin-auth";

const normalizeAdminEmail = (email: string) => email.trim().toLowerCase();
const adminLoginUnavailableMessage =
  "We could not sign you in right now. Please check the database connection and try again.";

function getBootstrapAdminCredentials() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) return null;

  return {
    email: normalizeAdminEmail(email),
    password,
    name: process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin",
  };
}

export async function adminLogin(email: string, password: string) {
  const normalizedEmail = normalizeAdminEmail(email);
  const bootstrapAdmin = getBootstrapAdminCredentials();

  try {
    let admin = await prisma.systemAdmin.findUnique({ where: { email: normalizedEmail } });

    if (
      bootstrapAdmin &&
      normalizedEmail === bootstrapAdmin.email &&
      password === bootstrapAdmin.password
    ) {
      const passwordHash = await bcrypt.hash(bootstrapAdmin.password, 12);
      admin = await prisma.systemAdmin.upsert({
        where: { email: bootstrapAdmin.email },
        update: {
          name: bootstrapAdmin.name,
          passwordHash,
          role: "OWNER",
          isActive: true,
        },
        create: {
          name: bootstrapAdmin.name,
          email: bootstrapAdmin.email,
          passwordHash,
          role: "OWNER",
          isActive: true,
        },
      });
    }

    if (!admin || !admin.isActive) throw new Error("Invalid credentials");

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new Error("Invalid credentials");

    const session = await createAdminSession(admin.id);

    await prisma.systemAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    await logAdminAction(admin.id, "LOGIN", "SystemAdmin", admin.id);

    return session;
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid credentials") {
      throw error;
    }

    console.error("Admin login failed", error);
    throw new Error(adminLoginUnavailableMessage);
  }
}

export async function adminLogout() {
  const session = await getCurrentAdmin();
  if (session) {
    await logAdminAction(session.admin.id, "LOGOUT", "SystemAdmin", session.admin.id);
  }
  await destroyAdminSession();
  redirect("/cloud-daftar-admin/login");
}

export async function checkAdminAuth() {
  const session = await getCurrentAdmin();
  return session !== null;
}

export async function getAdminDashboard() {
  const session = await requireAdmin();

  const [
    totalCompanies,
    totalUsers,
    totalSales,
    activeSubscriptions,
    pendingPayments,
    plans,
    confirmedInvoices,
  ] = await Promise.all([
    prisma.company.count({ where: { deletedAt: null } }),
    prisma.companyMembership.count({ where: { isActive: true } }),
    prisma.sale.aggregate({ _sum: { total: true }, where: { deletedAt: null } }),
    prisma.tenantSubscription.count({ where: { status: "ACTIVE" } }),
    prisma.billingInvoice.count({ where: { status: "SUBMITTED" } }),
    prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.billingInvoice.findMany({
      where: { status: "CONFIRMED" },
      select: { amount: true, baseAmount: true, baseCurrency: true },
    }),
  ]);

  const expiredSubscriptions = await prisma.tenantSubscription.count({
    where: { status: "EXPIRED" },
  });

  const totalRevenue = confirmedInvoices.reduce((sum, invoice) => {
    const baseAmount = Number(invoice.baseAmount || 0);
    return sum + (baseAmount > 0 ? baseAmount : Number(invoice.amount || 0));
  }, 0);

  return {
    totalCompanies,
    totalUsers,
    totalSales: Number(totalSales._sum.total || 0),
    activeSubscriptions,
    expiredSubscriptions,
    pendingPayments,
    totalRevenue,
    plans,
    admin: session.admin,
  };
}

export async function getTenantsList(search?: string, page = 1, pageSize = 20) {
  await requireAdmin();
  const where: Record<string, unknown> = { deletedAt: null };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where: where as any,
      include: {
        subscription: { include: { plan: true } },
        members: {
          where: { isActive: true },
          include: { user: { select: { name: true, email: true } } },
        },
        _count: { select: { members: true, products: true, sales: true, invoices: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.company.count({ where: where as any }),
  ]);

  return { data: companies, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getPendingPayments(page = 1, pageSize = 20) {
  await requireAdmin();
  const [submissions, total] = await Promise.all([
    prisma.paymentSubmission.findMany({
      where: { verifiedById: null },
      include: {
        invoice: {
          include: {
            company: {
              select: {
                name: true,
                slug: true,
                logo: true,
                email: true,
                currency: true,
                currencySymbol: true,
              },
            },
            plan: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentSubmission.count({ where: { verifiedById: null } }),
  ]);

  const data = submissions.map((s) => ({
    ...s.invoice,
    payment: s,
  }));

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getInvoicePayments(page = 1, pageSize = 50) {
  await requireAdmin();
  const [invoices, total] = await Promise.all([
    prisma.billingInvoice.findMany({
      include: {
        company: { select: { name: true, slug: true, currency: true, currencySymbol: true } },
        plan: true,
        payment: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.billingInvoice.count(),
  ]);

  return { data: invoices, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function verifyPayment(
  invoiceId: string,
  action: "confirm" | "reject",
  adminNotes?: string,
) {
  const session = await requireAdmin();

  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: { company: true, subscription: true, payment: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  if (action === "confirm") {
    await prisma.$transaction([
      prisma.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "CONFIRMED",
          paidAt: new Date(),
          verifiedAt: new Date(),
          verifiedById: session.admin.id,
          notes: adminNotes,
        },
      }),
      prisma.tenantSubscription.update({
        where: { companyId: invoice.companyId },
        data: {
          planId: invoice.planId,
          billingCycle: invoice.billingCycle,
          status: "ACTIVE",
          trialEndDate: null,
          cancelledAt: null,
          endDate: invoice.periodEnd,
          autoRenew: true,
        },
      }),
      ...(invoice.payment
        ? [
            prisma.paymentSubmission.update({
              where: { id: invoice.payment.id },
              data: { verifiedById: session.admin.id, verifiedAt: new Date() },
            }),
          ]
        : []),
    ]);
  } else {
    await prisma.$transaction([
      prisma.billingInvoice.update({
        where: { id: invoiceId },
        data: { status: "REJECTED", notes: adminNotes },
      }),
      ...(invoice.payment
        ? [
            prisma.paymentSubmission.update({
              where: { id: invoice.payment.id },
              data: {
                rejectionReason: adminNotes,
                verifiedById: session.admin.id,
                verifiedAt: new Date(),
              },
            }),
          ]
        : []),
    ]);
  }

  await logAdminAction(
    session.admin.id,
    action === "confirm" ? "PAYMENT_CONFIRMED" : "PAYMENT_REJECTED",
    "BillingInvoice",
    invoiceId,
    {
      invoiceNumber: invoice.invoiceNumber,
      notes: adminNotes,
    },
  );

  revalidatePath("/cloud-daftar-admin", "layout");

  return { success: true };
}

export async function suspendTenant(companyId: string) {
  const session = await requireAdmin();
  await prisma.company.update({ where: { id: companyId }, data: { isActive: false } });
  await prisma.tenantSubscription.update({ where: { companyId }, data: { status: "SUSPENDED" } });
  await logAdminAction(session.admin.id, "TENANT_SUSPENDED", "Company", companyId);
  return { success: true };
}

export async function reactivateTenant(companyId: string) {
  const session = await requireAdmin();
  await prisma.company.update({ where: { id: companyId }, data: { isActive: true } });
  await prisma.tenantSubscription.update({ where: { companyId }, data: { status: "ACTIVE" } });
  await logAdminAction(session.admin.id, "TENANT_REACTIVATED", "Company", companyId);
  return { success: true };
}

export async function extendSubscription(companyId: string, days: number) {
  const session = await requireAdmin();
  const sub = await prisma.tenantSubscription.findUnique({ where: { companyId } });
  if (!sub) throw new Error("No subscription");

  const newEnd = new Date(sub.endDate || new Date());
  newEnd.setDate(newEnd.getDate() + days);

  await prisma.tenantSubscription.update({
    where: { companyId },
    data: { endDate: newEnd, status: "ACTIVE" },
  });
  await logAdminAction(session.admin.id, "SUBSCRIPTION_EXTENDED", "TenantSubscription", sub.id, {
    days,
  });
  return { success: true };
}

export async function adminChangePlan(companyId: string, planId: string) {
  const session = await requireAdmin();
  const sub = await prisma.tenantSubscription.findUnique({ where: { companyId } });
  if (!sub) throw new Error("No subscription");

  await prisma.tenantSubscription.update({
    where: { companyId },
    data: { planId, status: "ACTIVE", trialEndDate: null, cancelledAt: null, autoRenew: true },
  });
  await logAdminAction(session.admin.id, "PLAN_CHANGED", "TenantSubscription", sub.id, {
    previousPlanId: sub.planId,
    newPlanId: planId,
  });
  return { success: true };
}

export async function getCompanyDetail(companyId: string) {
  await requireAdmin();
  return prisma.company.findUnique({
    where: { id: companyId },
    include: {
      subscription: { include: { plan: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
      },
      invoices: {
        include: { plan: true, payment: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: {
        select: {
          products: true,
          customers: true,
          suppliers: true,
          sales: true,
          purchases: true,
          members: true,
        },
      },
    },
  });
}

export async function getSystemAuditLogs(page = 1, pageSize = 50) {
  await requireAdmin();
  const [logs, total] = await Promise.all([
    prisma.systemAdminAuditLog.findMany({
      include: { admin: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.systemAdminAuditLog.count(),
  ]);
  return { data: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function listAdmins(page = 1, pageSize = 50) {
  await requireAdmin();
  const [admins, total] = await Promise.all([
    prisma.systemAdmin.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.systemAdmin.count(),
  ]);
  return { data: admins, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createAdmin({
  name,
  email,
  password,
  role,
}: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  const session = await requireAdmin();
  if (session.admin.role !== "OWNER" && session.admin.role !== "SUPER_ADMIN")
    throw new Error("Insufficient permissions");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const existing = await prisma.systemAdmin.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new Error("Email already in use");

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.systemAdmin.create({
    data: { name, email: email.toLowerCase(), passwordHash, role: role as any },
  });

  await logAdminAction(session.admin.id, "ADMIN_CREATED", "SystemAdmin", admin.id, { email, role });
  return { success: true };
}

export async function updateAdmin(
  adminId: string,
  data: { name?: string; role?: string; isActive?: boolean },
) {
  const session = await requireAdmin();
  if (session.admin.role !== "OWNER" && session.admin.role !== "SUPER_ADMIN")
    throw new Error("Insufficient permissions");

  const target = await prisma.systemAdmin.findUnique({ where: { id: adminId } });
  if (!target) throw new Error("Admin not found");
  if (target.role === "OWNER" && session.admin.id !== adminId)
    throw new Error("Cannot modify owner");

  const updated = await prisma.systemAdmin.update({
    where: { id: adminId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.role && { role: data.role as any }),
      ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
    },
  });

  await logAdminAction(session.admin.id, "ADMIN_UPDATED", "SystemAdmin", adminId, data);
  return { success: true };
}

export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const session = await requireAdmin();
  const admin = await prisma.systemAdmin.findUnique({ where: { id: session.admin.id } });
  if (!admin) throw new Error("Admin not found");

  const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.systemAdmin.update({ where: { id: admin.id }, data: { passwordHash } });
  await logAdminAction(session.admin.id, "PASSWORD_CHANGED", "SystemAdmin", admin.id);
  return { success: true };
}
