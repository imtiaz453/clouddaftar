"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

async function ensureEmployeeInCompany(userId: string, companyId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: { userId, companyId },
    select: { id: true },
  });
  if (!membership) throw new Error("Employee not found in this company");
}

// ── Employee Profile ──

export async function getEmployee(id: string) {
  const user = await requireCompanyAuth();
  const membership = await prisma.companyMembership.findFirst({
    where: { userId: id, companyId: user.companyId },
    include: { user: true, branch: true },
  });
  if (!membership) throw new Error("Employee not found");
  const [equipment, certifications] = await Promise.all([
    prisma.employeeEquipment.findMany({
      where: { assignedToId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.employeeCertification.findMany({
      where: { employeeId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { ...membership, equipment, certifications };
}

export async function updateEmployeeProfile(
  userId: string,
  data: { name?: string; phone?: string; email?: string },
) {
  const user = await requireCompanyAuth();
  await ensureEmployeeInCompany(userId, user.companyId);
  await prisma.user.update({ where: { id: userId }, data });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    metadata: data,
  });
  revalidatePath("/employees");
}

export async function updateEmployeeRole(
  membershipId: string,
  role: string,
  branchId?: string | null,
) {
  const user = await requireCompanyAuth();
  if (role === "OWNER" && user.role !== "OWNER") {
    throw new Error("Only the current owner can assign the owner role");
  }
  const membership = await prisma.companyMembership.findFirst({
    where: { id: membershipId, companyId: user.companyId },
    select: { id: true },
  });
  if (!membership) throw new Error("Employee membership not found");
  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId: user.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!branch) throw new Error("Branch not found in this company");
  }
  if (role === "OWNER") {
    const existingOwner = await prisma.companyMembership.findFirst({
      where: { companyId: user.companyId, role: "OWNER", isActive: true },
      select: { id: true },
    });
    if (existingOwner) {
      throw new Error("An owner already exists. Demote the current owner first.");
    }
  }
  await prisma.companyMembership.update({
    where: { id: membershipId },
    data: { role: role as any, ...(branchId !== undefined ? { branchId } : {}) },
  });
  await createAuditLog({
    userId: user.id,
    companyId: user.companyId,
    action: "UPDATE",
    entity: "CompanyMembership",
    entityId: membershipId,
    metadata: { role, branchId },
  });
  revalidatePath("/employees");
}

// ── Equipment ──

export async function getEquipment() {
  const user = await requireCompanyAuth();
  return prisma.employeeEquipment.findMany({
    where: { companyId: user.companyId },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createEquipment(data: {
  name: string;
  serialNumber?: string;
  category?: string;
  notes?: string;
}) {
  const user = await requireCompanyAuth();
  const equipment = await prisma.employeeEquipment.create({
    data: { ...data, companyId: user.companyId },
  });
  revalidatePath("/employees");
  return equipment;
}

export async function updateEquipment(
  id: string,
  data: {
    name?: string;
    serialNumber?: string;
    category?: string;
    status?: string;
    notes?: string;
    assignedToId?: string | null;
  },
) {
  const user = await requireCompanyAuth();
  const equipment = await prisma.employeeEquipment.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!equipment) throw new Error("Equipment not found");
  if (data.assignedToId) await ensureEmployeeInCompany(data.assignedToId, user.companyId);
  const payload: any = { ...data };
  if (data.assignedToId !== undefined) {
    payload.assignedToId = data.assignedToId || null;
    payload.assignedAt = data.assignedToId ? new Date() : null;
    payload.returnedAt = data.assignedToId ? null : new Date();
    if (data.assignedToId) payload.status = "ASSIGNED";
    else payload.status = "AVAILABLE";
  }
  await prisma.employeeEquipment.update({ where: { id }, data: payload });
  revalidatePath("/employees");
}

export async function deleteEquipment(id: string) {
  const user = await requireCompanyAuth();
  const equipment = await prisma.employeeEquipment.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!equipment) throw new Error("Equipment not found");
  await prisma.employeeEquipment.delete({ where: { id } });
  revalidatePath("/employees");
}

// ── Certifications ──

export async function createCertification(data: {
  employeeId: string;
  name: string;
  issuer?: string;
  issueDate?: Date;
  expiryDate?: Date;
  referenceUrl?: string;
}) {
  const user = await requireCompanyAuth();
  await ensureEmployeeInCompany(data.employeeId, user.companyId);
  const cert = await prisma.employeeCertification.create({
    data: { ...data, companyId: user.companyId },
  });
  revalidatePath("/employees");
  return cert;
}

export async function deleteCertification(id: string) {
  const user = await requireCompanyAuth();
  const cert = await prisma.employeeCertification.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!cert) throw new Error("Certification not found");
  await prisma.employeeCertification.delete({ where: { id } });
  revalidatePath("/employees");
}

// ── Dashboard Metrics ──

export async function getEmployeeRetention() {
  const user = await requireCompanyAuth();
  const memberships = await prisma.companyMembership.findMany({
    where: { companyId: user.companyId, isActive: true },
    include: { user: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const now = new Date();
  const total = memberships.length;
  const avgTenure =
    total > 0
      ? Math.round(
          memberships.reduce((s, m) => s + (now.getTime() - m.joinedAt.getTime()) / 86400000, 0) /
            total,
        )
      : 0;
  const byYear = memberships.reduce((acc: Record<string, number>, m) => {
    const year = m.joinedAt.getFullYear().toString();
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});
  const lowTenure = memberships.filter(
    (m) => (now.getTime() - m.joinedAt.getTime()) / 86400000 < 90,
  ).length;
  return {
    total,
    avgTenure,
    lowTenure,
    byYear,
    memberships: memberships.map((m) => ({
      id: m.userId,
      name: m.user.name,
      branch: m.branch?.name,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  };
}

export async function deleteEmployeeRecord(userId: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: currentUserId } = user;

  const record = await prisma.employeeRecord.findFirst({
    where: { userId, companyId, isActive: true },
  });
  if (!record) throw new Error("Employee not found");

  await prisma.employeeRecord.update({
    where: { id: record.id },
    data: { isActive: false },
  });

  if (record.hasSystemAccess && record.userId) {
    await prisma.companyMembership.updateMany({
      where: { userId: record.userId, companyId },
      data: { isActive: false },
    });
  }

  await createAuditLog({
    userId: currentUserId,
    companyId,
    action: "DISABLE",
    entity: "EmployeeRecord",
    entityId: record.id,
    metadata: { name: record.name, action: "deleted" },
  });
  revalidatePath("/employees");
}
