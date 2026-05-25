import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user?.id) {
    return NextResponse.json({ sessions: [] });
  }

  const currentSessionId = user.activeLoginSessionId;

  const sessions = await prisma.activeLoginSession.findMany({
    where: {
      userId: user.id,
      expiresAt: { gt: new Date() },
      ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
    },
    select: {
      deviceLabel: true,
      deviceModel: true,
      browser: true,
      os: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sessions });
}
