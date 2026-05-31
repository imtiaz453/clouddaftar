import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { membershipId } = await req.json();
    const currentUserId = (session.user as any).id;
    const companyId = (session.user as any).companyId;

    if (!companyId) {
      return NextResponse.json({ error: "Company context required" }, { status: 403 });
    }

    const membership = await prisma.companyMembership.findFirst({
      where: { id: membershipId, companyId },
      select: { userId: true, role: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    if (membership.userId === currentUserId) {
      return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
    }
    if (membership.role === "OWNER") {
      return NextResponse.json({ error: "Owner cannot be removed here" }, { status: 403 });
    }

    if (!(await checkPermission(PERMISSIONS.USERS_MANAGE))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await prisma.companyMembership.update({
      where: { id: membershipId },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: currentUserId,
      companyId,
      action: "DELETE",
      entity: "CompanyMembership",
      entityId: membershipId,
      metadata: { type: "removed_from_company" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("/api/users/remove error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove user" },
      { status: 500 },
    );
  }
}
