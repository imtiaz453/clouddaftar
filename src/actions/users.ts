"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createAuditLog, createNotification } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { normalizeUserPermissionOverride } from "@/lib/constants";
import crypto from "crypto";

export async function getUsers() {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const members = await prisma.companyMembership.findMany({
    where: { companyId, isActive: true },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, isActive: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return members.map((m) => ({
    id: m.user.id,
    membershipId: m.id,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
    permissionOverrides: m.permissionOverrides,
    isActive: m.user.isActive,
    joinedAt: m.joinedAt,
  }));
}

export async function getInvitations() {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  return prisma.invitation.findMany({
    where: { companyId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUserDirectly(data: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

  if (existingUser) {
    throw new Error("A user with this email already exists in the system. Please use a different email.");
  }

  const newUser = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      companies: {
        create: {
          role: data.role as any,
          companyId,
        },
      },
    },
    include: {
      companies: { where: { companyId }, take: 1 },
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "User",
    entityId: newUser.id,
    metadata: { email: data.email, role: data.role, type: "created_directly" },
  });

  await createNotification({
    companyId,
    userId,
    title: "User Created",
    message: `User account created for ${data.email}`,
    type: "SUCCESS",
  });

  revalidatePath("/users");
  const membership = newUser.companies[0];
  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    image: newUser.image,
    role: membership.role,
    isActive: newUser.isActive,
    joinedAt: membership.joinedAt,
  };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const user = await requireCompanyAuth();
  const { companyId, id: currentUserId } = user;

  if (userId === currentUserId) {
    throw new Error("You cannot deactivate yourself");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  await createAuditLog({
    userId: currentUserId,
    companyId,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    metadata: { type: isActive ? "activated" : "deactivated" },
  });

  await createNotification({
    companyId,
    userId: currentUserId,
    title: isActive ? "User Activated" : "User Deactivated",
    message: `User account ${isActive ? "activated" : "deactivated"}`,
    type: isActive ? "SUCCESS" : "WARNING",
  });

  revalidatePath("/users");
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: currentUserId } = user;

  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await createAuditLog({
    userId: currentUserId,
    companyId,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    metadata: { type: "password_reset_by_admin" },
  });

  await createNotification({
    companyId,
    userId: currentUserId,
    title: "Password Reset",
    message: "User password has been reset by admin",
    type: "INFO",
  });

  revalidatePath("/users");
}

export async function inviteUser(data: { email: string; role: string }) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existing = await prisma.companyMembership.findFirst({
    where: { companyId, user: { email: data.email } },
  });

  if (existing) {
    throw new Error("User is already a member");
  }

  const token = crypto.randomBytes(32).toString("hex");

  const invitation = await prisma.invitation.create({
    data: {
      email: data.email,
      companyId,
      role: data.role as any,
      token,
      invitedById: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "CREATE",
    entity: "Invitation",
    entityId: invitation.id,
    metadata: { email: data.email, role: data.role },
  });

  await createNotification({
    companyId,
    userId,
    title: "Invitation Sent",
    message: `Invitation sent to ${data.email}`,
    type: "INFO",
  });

  revalidatePath("/users");
  return invitation;
}

export async function updateUserRole(membershipId: string, role: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  await prisma.companyMembership.update({
    where: { id: membershipId },
    data: { role: role as any },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "CompanyMembership",
    entityId: membershipId,
    metadata: { type: "role_change", newRole: role },
  });

  revalidatePath("/users");
}

export async function updateUserPermissions(membershipId: string, permissionOverrides: unknown) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const normalized = normalizeUserPermissionOverride(permissionOverrides);

  const membership = await prisma.companyMembership.findFirst({
    where: { id: membershipId, companyId },
    select: { id: true, userId: true, role: true },
  });
  if (!membership) throw new Error("Membership not found");
  if (membership.role === "OWNER") throw new Error("Owner permissions cannot be overridden");

  await prisma.companyMembership.update({
    where: { id: membershipId },
    data: { permissionOverrides: normalized as any },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "UPDATE",
    entity: "CompanyMembership",
    entityId: membershipId,
    metadata: { type: "permission_override", mode: normalized.mode },
  });

  revalidatePath("/users");
  revalidatePath("/users/roles");
}

export async function removeUser(membershipId: string) {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const membership = await prisma.companyMembership.findUnique({
    where: { id: membershipId },
    select: { userId: true },
  });

  if (membership?.userId === userId) {
    throw new Error("You cannot remove yourself from the company");
  }

  await prisma.companyMembership.update({
    where: { id: membershipId },
    data: { isActive: false },
  });

  await createAuditLog({
    userId,
    companyId,
    action: "DELETE",
    entity: "CompanyMembership",
    entityId: membershipId,
    metadata: { type: "removed_from_company" },
  });

  await createNotification({
    companyId,
    userId,
    title: "Member Removed",
    message: "A team member has been removed from the company",
    type: "INFO",
  });

  revalidatePath("/users");
}

export async function revokeInvitation(invitationId: string) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
  });

  revalidatePath("/users");
}
