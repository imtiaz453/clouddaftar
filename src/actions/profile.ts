"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function getProfile() {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  });

  const membership = await prisma.companyMembership.findFirst({
    where: { userId: user.id, companyId },
    select: { role: true, joinedAt: true },
  });

  return {
    id: profile!.id,
    name: profile!.name,
    email: profile!.email,
    image: profile!.image,
    phone: profile!.phone,
    isActive: profile!.isActive,
    createdAt: profile!.createdAt,
    role: membership?.role || null,
    joinedAt: membership?.joinedAt || null,
  };
}

export async function updateProfile(data: {
  name: string;
  email: string;
  phone?: string;
  image?: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const existing = await prisma.user.findFirst({
    where: { email: data.email, id: { not: user.id } },
  });
  if (existing) throw new Error("Email is already in use");

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      image: data.image || null,
    },
  });

  await createAuditLog({
    userId: user.id,
    companyId,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    metadata: { updatedFields: ["name", "email", "phone", "image"].filter((f) => (data as any)[f] !== undefined) },
  });

  revalidatePath("/profile");
  return { name: updated.name, email: updated.email, phone: updated.phone, image: updated.image };
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const user = await requireCompanyAuth();
  const { companyId } = user;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.passwordHash) throw new Error("No password set");

  const isValid = await verifyPassword(data.currentPassword, dbUser.passwordHash);
  if (!isValid) throw new Error("Current password is incorrect");

  if (data.newPassword.length < 8) throw new Error("New password must be at least 8 characters");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(data.newPassword) },
  });

  await createAuditLog({
    userId: user.id,
    companyId,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    metadata: { type: "password_change" },
  });

  revalidatePath("/profile");
}
