import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";
import { getEffectiveUserPermissions } from "@/lib/constants";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required");
  return user;
}

export async function requireCompanyAuth(): Promise<SessionUser & { companyId: string }> {
  const user = await requireAuth();
  if (!user.companyId) throw new Error("Company context required");
  return user as SessionUser & { companyId: string };
}

export async function checkPermission(requiredPermission: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "OWNER") return true;

  let rolePermissions: unknown = undefined;
  let permissionOverrides: unknown = undefined;

  if (user.companyId) {
    try {
      const [settings, membership] = await Promise.all([
        prisma.companySettings.findUnique({
          where: { companyId: user.companyId },
          select: { rolePermissions: true },
        }),
        prisma.companyMembership.findFirst({
          where: { companyId: user.companyId, userId: user.id, isActive: true },
          select: { permissionOverrides: true },
        }),
      ]);
      rolePermissions = settings?.rolePermissions;
      permissionOverrides = membership?.permissionOverrides;
    } catch {}
  }

  const permissions = getEffectiveUserPermissions(
    user.role,
    rolePermissions,
    permissionOverrides,
  );
  return permissions.includes(requiredPermission);
}

export async function requirePermission(permission: string): Promise<void> {
  const hasPermission = await checkPermission(permission);
  if (!hasPermission) throw new Error("Insufficient permissions");
}
