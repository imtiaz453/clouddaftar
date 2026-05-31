import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createAuditLog, createNotification } from "@/lib/audit";
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

    if (targetUserId === currentUserId) {
      return NextResponse.json({ error: "You cannot change your own status" }, { status: 400 });
    }

    if (!(await checkPermission(PERMISSIONS.USERS_DISABLE))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const targetMembership = await prisma.companyMembership.findFirst({
      where: { userId: targetUserId, companyId, isActive: true },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "User not found in your company" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
    });

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
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
