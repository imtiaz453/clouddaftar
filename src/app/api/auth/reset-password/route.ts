import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validations";
import {
  PASSWORD_RESET_SESSION_COOKIE,
  getClientIp,
  hashPasswordResetSecret,
  logPasswordResetEvent,
} from "@/lib/password-reset";

function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(req.url).origin || origin === process.env.NEXTAUTH_URL;
}

export async function GET(req: Request) {
  const sessionToken = req.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${PASSWORD_RESET_SESSION_COOKIE}=`))
    ?.split("=")[1];

  if (!sessionToken) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  const resetCode = await prisma.passwordResetCode.findUnique({
    where: { resetSessionTokenHash: hashPasswordResetSecret(sessionToken) },
    select: { id: true, expiresAt: true, consumedAt: true, lockedAt: true, verifiedAt: true },
  });

  if (
    !resetCode ||
    !resetCode.verifiedAt ||
    resetCode.consumedAt ||
    resetCode.lockedAt ||
    resetCode.expiresAt < new Date()
  ) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({ valid: true });
}

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ipAddress = getClientIp(req.headers);
  const userAgent = req.headers.get("user-agent");
  const sessionToken = req.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${PASSWORD_RESET_SESSION_COOKIE}=`))
    ?.split("=")[1];

  if (!sessionToken) {
    return NextResponse.json(
      { error: "Your reset session has expired. Please request a new code." },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Enter a valid password" },
        { status: 400 },
      );
    }

    const resetCode = await prisma.passwordResetCode.findUnique({
      where: { resetSessionTokenHash: hashPasswordResetSecret(sessionToken) },
      include: { user: { select: { id: true, email: true } } },
    });

    if (
      !resetCode ||
      !resetCode.user ||
      !resetCode.verifiedAt ||
      resetCode.consumedAt ||
      resetCode.lockedAt ||
      resetCode.expiresAt < new Date()
    ) {
      return NextResponse.json(
        { error: "Your reset session has expired. Please request a new code." },
        { status: 401 },
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetCode.user.id },
        data: { passwordHash: await hashPassword(parsed.data.password) },
      }),
      prisma.passwordResetCode.updateMany({
        where: { email: resetCode.email, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      prisma.activeLoginSession.deleteMany({ where: { userId: resetCode.user.id } }),
      prisma.session.deleteMany({ where: { userId: resetCode.user.id } }),
    ]);

    await logPasswordResetEvent({
      action: "PASSWORD_RESET_COMPLETED",
      userId: resetCode.user.id,
      email: resetCode.email,
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json({ success: true, redirectTo: "/login?reset=success" });
    response.cookies.delete(PASSWORD_RESET_SESSION_COOKIE);
    return response;
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
