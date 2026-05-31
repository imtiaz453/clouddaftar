import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: targetUserId, isActive } = await req.json();
    const currentUserId = (session.user as any).id;
    const companyId = (session.user as any).companyId;

    if (!companyId) {
      return NextResponse.json({ error: "Company context required" }, { status: 403 });
    }

    if (targetUserId === currentUserId) {
      return NextResponse.json({ error: "You cannot change your own status" }, { status: 400 });
    }

    if (!(await checkPermission(PERMISSIONS.USERS_DISABLE))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const targetMembership = await prisma.companyMembership.findFirst({
      where: { userId: targetUserId, companyId },
      select: { id: true, userId: true, role: true },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "User not found in your company" }, { status: 404 });
    }
    if (targetMembership.role === "OWNER") {
      return NextResponse.json({ error: "Owner account status cannot be changed here" }, { status: 403 });
    }

    // Keep activation/deactivation tenant-scoped.
    // Updating User.isActive=false blocks the person from logging in globally.
    await prisma.companyMembership.update({
      where: { id: targetMembership.id },
      data: { isActive },
    });

    // Repair users who were accidentally globally disabled by the old flow.
    if (isActive) {
      await prisma.user.update({
        where: { id: targetMembership.userId },
        data: { isActive: true },
      });
    }

    await createAuditLog({
      userId: currentUserId,
      companyId,
      action: "UPDATE",
      entity: "User",
      entityId: targetUserId,
      metadata: { type: isActive ? "activated" : "deactivated" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("/api/users/toggle-active error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user" },
      { status: 500 },
    );
  }
}
