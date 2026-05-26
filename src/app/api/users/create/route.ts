import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth-helper";
import { createAuditLog } from "@/lib/audit";
import { isCustomRoleKey, normalizeRolePermissionOverrides } from "@/lib/constants";

const APP_ROUTES = new Set([
  "api",
  "_next",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "cloud-daftar-admin",
  "favicon.ico",
  "manifest.json",
]);

async function resolveCustomRole(roleKey: string, companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: { select: { rolePermissions: true } } },
  });
  const rolePermissions = company?.settings?.rolePermissions
    ? normalizeRolePermissionOverrides(company.settings.rolePermissions)
    : {};
  const perms = rolePermissions[roleKey];
  if (!perms) {
    return null;
  }
  return { permissionOverrides: { mode: "custom" as const, permissions: perms }, role: "STAFF" };
}

async function getCompanyIdFromTenantReferrer(req: Request, userId?: string) {
  try {
    const referer = req.headers.get("referer") || "";
    if (!referer) return null;
    const url = new URL(referer);
    const slug = url.pathname.split("/").filter(Boolean)[0];
    if (!slug || APP_ROUTES.has(slug)) return null;
    const company = await prisma.company.findFirst({
      where: {
        slug,
        isActive: true,
        deletedAt: null,
        ...(userId ? { members: { some: { userId, isActive: true } } } : {}),
      },
      select: { id: true },
    });
    return company?.id || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const name = typeof data.name === "string" ? data.name.trim() : "";

    if (!name || !email || !data.password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 },
      );
    }
    if (data.password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const branchId = typeof data.branchId === "string" && data.branchId ? data.branchId : undefined;
    let role = data.role || "STAFF";
    const allowedRoles = ["OWNER", "ADMIN", "MANAGER", "STAFF", "CASHIER"];
    const isCustomRole = isCustomRoleKey(role);
    if (!isCustomRole && !allowedRoles.includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }

    const appUser = await getCurrentUser();
    const appCompanyId =
      appUser?.companyId || (await getCompanyIdFromTenantReferrer(req, appUser?.id));
    const explicitCompanyId =
      typeof data.companyId === "string" && data.companyId.trim() ? data.companyId.trim() : null;

    // Super-admin panel usage only when a company is explicitly selected.
    const admin = await getCurrentAdmin();
    if (admin && explicitCompanyId && (!appUser || explicitCompanyId !== appCompanyId)) {
      const companyId = explicitCompanyId;
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
      }
      if (isCustomRole) {
        const resolved = await resolveCustomRole(role, companyId);
        if (!resolved) {
          return NextResponse.json(
            { success: false, error: `Custom role "${role}" not found in company settings` },
            { status: 400 },
          );
        }
        role = resolved.role;
        data.permissionOverrides = resolved.permissionOverrides;
      }
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            error: "A user with this email already exists in the system. Please use a different email.",
          },
          { status: 409 },
        );
      }
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await hashPassword(data.password),
          companies: {
            create: {
              role,
              companyId,
              ...(branchId ? { branchId } : {}),
              ...(data.permissionOverrides
                ? { permissionOverrides: data.permissionOverrides }
                : {}),
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          isActive: true,
          companies: {
            where: { companyId },
            take: 1,
            select: { id: true, role: true, companyId: true, joinedAt: true },
          },
        },
      });
      return NextResponse.json({
        success: true,
        data: newUser,
        message: "User created successfully",
      });
    }

    // Regular NextAuth session (in-app usage)
    const user = appUser;
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!appCompanyId) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not detect the current company. Open the tenant workspace and try again.",
        },
        { status: 403 },
      );
    }

    const { id: userId } = user;
    const companyId = appCompanyId;

    if (isCustomRole) {
      const resolved = await resolveCustomRole(role, companyId);
      if (!resolved) {
        return NextResponse.json(
          { success: false, error: `Custom role "${role}" not found in company settings` },
          { status: 400 },
        );
      }
      role = resolved.role;
      data.permissionOverrides = resolved.permissionOverrides;
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "A user with this email already exists in the system. Please use a different email.",
        },
        { status: 409 },
      );
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(data.password),
        companies: {
          create: {
            role,
            companyId,
            ...(branchId ? { branchId } : {}),
            ...(data.permissionOverrides ? { permissionOverrides: data.permissionOverrides } : {}),
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isActive: true,
        companies: {
          where: { companyId },
          take: 1,
          select: { id: true, role: true, companyId: true, joinedAt: true },
        },
      },
    });

    await createAuditLog({
      userId,
      companyId,
      action: "CREATE",
      entity: "User",
      entityId: newUser.id,
      metadata: { email, role },
    });
    return NextResponse.json({
      success: true,
      data: newUser,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("/api/users/create error:", error);
    const message = error instanceof Error ? error.message : "Failed to create user";
    if (message.includes("Unique constraint")) {
      return NextResponse.json(
        { success: false, error: "A user with this email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
