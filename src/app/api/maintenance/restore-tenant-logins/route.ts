import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const token = process.env.MAINTENANCE_TOKEN;
  const provided = req.headers.get("x-maintenance-token") || "";

  if (!token || provided !== token) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;

  const userWhere = email
    ? { email: { equals: email, mode: "insensitive" as const } }
    : { companies: { some: { company: { isActive: true, deletedAt: null } } } };

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    return NextResponse.json({ success: true, repairedUsers: 0, repairedMemberships: 0 });
  }

  const userIds = users.map((u) => u.id);

  const repairedUsers = await prisma.user.updateMany({
    where: { id: { in: userIds }, isActive: false },
    data: { isActive: true },
  });

  const repairedMemberships = await prisma.companyMembership.updateMany({
    where: {
      userId: { in: userIds },
      isActive: false,
      company: { isActive: true, deletedAt: null },
    },
    data: { isActive: true },
  });

  return NextResponse.json({
    success: true,
    repairedUsers: repairedUsers.count,
    repairedMemberships: repairedMemberships.count,
    matchedUsers: users.length,
  });
}
