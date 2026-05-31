import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { isCustomRoleKey, normalizeRolePermissionOverrides, PERMISSIONS } from "@/lib/constants";
import { checkPermission } from "@/lib/auth-helper";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { membershipId, role } = await req.json();
    const userId = (session.user as any).id;
    const companyId = (session.user as any).companyId;

    const currentUserRole = (session.user as any).role;
    if (!(await checkPermission(PERMISSIONS.ROLES_MANAGE))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const target = await prisma.companyMembership.findFirst({
      where: { id: membershipId, companyId },
    });
    if (!target) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const allowedRoles = ["OWNER", "ADMIN", "MANAGER", "STAFF", "CASHIER"];
    const isCustomRole = isCustomRoleKey(role);

    if (!isCustomRole && !allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (role === "OWNER") {
      if (currentUserRole !== "OWNER") {
        return NextResponse.json(
          { error: "Only the current owner can assign the owner role" },
          { status: 403 },
        );
      }
      const existingOwner = await prisma.companyMembership.findFirst({
        where: { companyId, role: "OWNER", isActive: true, id: { not: membershipId } },
        select: { id: true },
      });
      if (existingOwner) {
        return NextResponse.json(
          { error: "An owner already exists. Demote the current owner first." },
          { status: 400 },
        );
      }
    }

    let resolvedRole = role;
    let permissionOverrides: unknown = undefined;

    if (isCustomRole) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { settings: { select: { rolePermissions: true } } },
      });
      const rolePermissions = company?.settings?.rolePermissions
        ? normalizeRolePermissionOverrides(company.settings.rolePermissions)
        : {};
      const perms = rolePermissions[role];
      if (!perms) {
        return NextResponse.json(
          { error: `Custom role "${role}" not found in company settings` },
          { status: 400 },
        );
      }
      resolvedRole = "STAFF";
      permissionOverrides = { mode: "custom", permissions: perms };
    }

    await prisma.companyMembership.update({
      where: { id: membershipId },
      data:
        permissionOverrides !== undefined
          ? { role: resolvedRole, permissionOverrides: permissionOverrides as any }
          : { role: resolvedRole },
    });

    await createAuditLog({
      userId,
      companyId,
      action: "UPDATE",
      entity: "CompanyMembership",
      entityId: membershipId,
      metadata: { type: "role_change", newRole: role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
