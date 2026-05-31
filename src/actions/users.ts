"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth, requirePermission } from "@/lib/auth-helper";
import { createAuditLog, createNotification } from "@/lib/audit";
import { sendPushNotificationWithAdmins } from "@/lib/push";
import { hashPassword } from "@/lib/auth";
import { isCustomRoleKey, normalizeUserPermissionOverride, PERMISSIONS } from "@/lib/constants";
import crypto from "crypto";

const MANAGEABLE_ROLES = new Set(["ADMIN", "MANAGER", "STAFF", "CASHIER"]);

function assertManageableRole(role: string) {
  if (!MANAGEABLE_ROLES.has(role) && !isCustomRoleKey(role)) {
    throw new Error("Invalid role for this operation");
  }
}

async function requireActiveMembershipByUserId(userId: string, companyId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: { userId, companyId, isActive: true },
    select: { id: true, userId: true, role: true },
  });

  if (!membership) {
    throw new Error("User not found in this company");
  }

  return membership;
}

async function requireMembershipInCompany(membershipId: string, companyId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: { id: membershipId, companyId },
    select: { id: true, userId: true, role: true, isActive: true },
  });

  if (!membership) {
    throw new Error("Membership not found in this company");
  }

  return membership;
}

export async function getUsers() {
  await requirePermission(PERMISSIONS.USERS_VIEW);
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const members = await prisma.companyMembership.findMany({
    where: { companyId, isActive: true },
    include: {
      branch: { select: { id: true, name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          isActive: true,
          assignedStores: {
            where: { companyId, deletedAt: null, isActive: true },
            select: { id: true, name: true, type: true },
            orderBy: { name: "asc" },
          },
          assignedStockLocations: {
            where: { companyId, deletedAt: null, isActive: true },
            select: { id: true, name: true, type: true },
            orderBy: { name: "asc" },
          },
        },
      },
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
    branch: m.branch,
    assignedStores: m.user.assignedStores,
    assignedStockLocations: m.user.assignedStockLocations,
    isActive: m.user.isActive,
    joinedAt: m.joinedAt,
  }));
}

export async function getInvitations() {
  await requirePermission(PERMISSIONS.USERS_VIEW);
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
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  assertManageableRole(data.role);
  if (!data.password || data.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });

  if (existingUser) {
    throw new Error(
      "A user with this email already exists in the system. Please use a different email.",
    );
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
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "User Created",
    body: `User ${data.email} (${data.role}) created by ${user.name || userId}`,
    url: "/users",
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
  await requirePermission(PERMISSIONS.USERS_DISABLE);
  const user = await requireCompanyAuth();
  const { companyId, id: currentUserId } = user;

  if (userId === currentUserId) {
    throw new Error("You cannot change your own status");
  }

  const membership = await requireActiveMembershipByUserId(userId, companyId);
  if (membership.role === "OWNER") {
    throw new Error("Owner account status cannot be changed here");
  }

  await prisma.user.update({
    where: { id: membership.userId },
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
  await sendPushNotificationWithAdmins(companyId, currentUserId, {
    title: isActive ? "User Activated" : "User Deactivated",
    body: `User account ${isActive ? "activated" : "deactivated"} by ${user.name || currentUserId}`,
    url: "/users",
  });

  revalidatePath("/users");
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requirePermission(PERMISSIONS.USERS_RESET_PASSWORD);
  const user = await requireCompanyAuth();
  const { companyId, id: currentUserId } = user;

  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const membership = await requireActiveMembershipByUserId(userId, companyId);
  if (membership.role === "OWNER") {
    throw new Error("Owner password cannot be reset here");
  }

  await prisma.user.update({
    where: { id: membership.userId },
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
  await sendPushNotificationWithAdmins(companyId, currentUserId, {
    title: "Password Reset",
    body: `User password reset by ${user.name || currentUserId}`,
    url: "/users",
  });

  revalidatePath("/users");
}

export async function inviteUser(data: { email: string; role: string }) {
  await requirePermission(PERMISSIONS.USERS_INVITE);
  assertManageableRole(data.role);
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
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Invitation Sent",
    body: `Invitation sent to ${data.email} (${data.role}) by ${user.name || userId}`,
    url: "/users",
  });

  revalidatePath("/users");
  return invitation;
}

export async function updateUserRole(membershipId: string, role: string) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  assertManageableRole(role);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const membership = await requireMembershipInCompany(membershipId, companyId);
  if (membership.role === "OWNER") {
    throw new Error("Owner role cannot be changed here");
  }

  await prisma.companyMembership.update({
    where: { id: membership.id },
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

  await createNotification({
    companyId,
    userId,
    title: "User Role Updated",
    message: `User role changed to ${role}`,
    type: "INFO",
  });
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "User Role Updated",
    body: `User role changed to ${role} by ${user.name || userId}`,
    url: "/users",
  });

  revalidatePath("/users");
}

export async function updateUserPermissions(membershipId: string, permissionOverrides: unknown) {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;
  const normalized = normalizeUserPermissionOverride(permissionOverrides);

  const membership = await requireMembershipInCompany(membershipId, companyId);
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

  await createNotification({
    companyId,
    userId,
    title: "Permissions Updated",
    message: `User permissions overridden (${normalized.mode} mode)`,
    type: "INFO",
  });
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Permissions Updated",
    body: `Permissions updated for membership ${membershipId} by ${user.name || userId}`,
    url: "/users",
  });

  revalidatePath("/users");
  revalidatePath("/users/roles");
}

export async function removeUser(membershipId: string) {
  await requirePermission(PERMISSIONS.USERS_MANAGE);
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const membership = await requireMembershipInCompany(membershipId, companyId);

  if (membership.userId === userId) {
    throw new Error("You cannot remove yourself from the company");
  }
  if (membership.role === "OWNER") {
    throw new Error("Owner cannot be removed here");
  }

  await prisma.companyMembership.update({
    where: { id: membership.id },
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
  await sendPushNotificationWithAdmins(companyId, userId, {
    title: "Member Removed",
    body: `A team member removed from company by ${user.name || userId}`,
    url: "/users",
  });

  revalidatePath("/users");
}

export async function revokeInvitation(invitationId: string) {
  await requirePermission(PERMISSIONS.USERS_INVITE);
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, companyId, status: "PENDING" },
    select: { id: true },
  });
  if (!invitation) {
    throw new Error("Invitation not found in this company");
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "REVOKED" },
  });

  revalidatePath("/users");
}
