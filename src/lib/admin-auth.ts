import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import type { SystemAdmin, SystemAdminRole, Prisma } from "@prisma/client";

const SESSION_COOKIE = "cloud_daftar_admin_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export type AdminSession = {
  admin: Pick<SystemAdmin, "id" | "name" | "email" | "role" | "avatar">;
  token: string;
};

export async function createAdminSession(adminId: string): Promise<AdminSession> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.systemAdminSession.create({
    data: { adminId, token, expiresAt },
  });

  const admin = await prisma.systemAdmin.findUnique({
    where: { id: adminId },
    select: { id: true, name: true, email: true, role: true, avatar: true },
  });

  if (!admin) throw new Error("Admin not found");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return { admin, token };
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.systemAdminSession.deleteMany({ where: { token } });
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getCurrentAdmin(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = await prisma.systemAdminSession.findUnique({
      where: { token },
      include: {
        admin: {
          select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true },
        },
      },
    });

    if (!session || !session.admin.isActive) return null;
    if (session.expiresAt < new Date()) {
      await prisma.systemAdminSession.delete({ where: { id: session.id } });
      return null;
    }

    return { admin: session.admin, token: session.token };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getCurrentAdmin();
  if (!session) redirect("/cloud-daftar-admin/login");
  return session;
}

export async function requireAdminRole(...roles: SystemAdminRole[]): Promise<AdminSession> {
  const session = await requireAdmin();
  if (roles.length > 0 && !roles.includes(session.admin.role)) {
    redirect("/cloud-daftar-admin/dashboard");
  }
  return session;
}

export async function logAdminAction(
  adminId: string,
  action: string,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.systemAdminAuditLog.create({
    data: { adminId, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue },
  });
}
