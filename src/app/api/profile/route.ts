import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, email, phone, image } = await req.json();
    const userId = (session.user as any).id;
    const companyId = (session.user as any).companyId;

    const existing = await prisma.user.findFirst({
      where: { email, id: { not: userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name, email, phone: phone || null, image: image || null },
    });

    await createAuditLog({
      userId,
      companyId,
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      metadata: { type: "profile_update" },
    });

    return NextResponse.json({
      success: true,
      data: { name: updated.name, email: updated.email, phone: updated.phone, image: updated.image },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
