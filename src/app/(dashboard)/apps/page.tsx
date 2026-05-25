import { AppsPage } from "@/features/apps/apps-page";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

async function getAppsPermissionContext() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { companyId?: string; companySlug?: string; id?: string };
  const companyId = sessionUser?.companyId;
  const userId = sessionUser?.id;
  if (!companyId || !userId) {
    return {
      companySlug: sessionUser?.companySlug ?? null,
      rolePermissions: null,
      userPermissionOverrides: null,
      planCode: "starter",
    };
  }

  const [settings, membership, subscription] = await Promise.all([
    prisma.companySettings.findUnique({
      where: { companyId },
      select: { rolePermissions: true },
    }),
    prisma.companyMembership.findFirst({
      where: { companyId, userId, isActive: true },
      select: { permissionOverrides: true },
    }),
    prisma.tenantSubscription.findUnique({
      where: { companyId },
      select: { plan: { select: { code: true } } },
    }),
  ]);

  return {
    companySlug: sessionUser?.companySlug ?? null,
    rolePermissions: (settings?.rolePermissions as Record<string, string[]> | null) ?? null,
    userPermissionOverrides:
      (membership?.permissionOverrides as Record<string, unknown> | null) ?? null,
    planCode: subscription?.plan?.code ?? "starter",
  };
}

export default async function AppsRoutePage() {
  const context = await getAppsPermissionContext();
  return <AppsPage {...context} />;
}
