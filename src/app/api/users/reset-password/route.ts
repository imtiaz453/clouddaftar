import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId: targetUserId, newPassword } = await req.json();
    const currentUserId = (session.user as any).id;
    const companyId = (session.user as any).companyId;

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const currentUserRole = (session.user as any).role;
    if (currentUserRole !== "OWNER" && currentUserRole !== "ADMIN") {
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
      data: { passwordHash: await hashPassword(newPassword) },
    });

    await createAuditLog({
      userId: currentUserId,
      companyId,
      action: "UPDATE",
      entity: "User",
      entityId: targetUserId,
      metadata: { type: "password_reset_by_admin" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
