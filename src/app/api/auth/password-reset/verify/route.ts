import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPasswordResetCodeSchema } from "@/lib/validations";
import {
  PASSWORD_RESET_SESSION_COOKIE,
  PASSWORD_RESET_SESSION_TTL_MS,
  generateResetSessionToken,
  getClientIp,
  hashPasswordResetSecret,
  logPasswordResetEvent,
  normalizeResetEmail,
} from "@/lib/password-reset";

function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(req.url).origin || origin === process.env.NEXTAUTH_URL;
}

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ipAddress = getClientIp(req.headers);
  const userAgent = req.headers.get("user-agent");

  try {
    const body = await req.json();
    const parsed = verifyPasswordResetCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Enter the 6-digit verification code" }, { status: 400 });
    }

    const email = normalizeResetEmail(parsed.data.email);
    const limit = rateLimit(`password-reset:verify:${email}:${ipAddress}`, 10, 10 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please request a new code." },
        { status: 429 },
      );
    }

    const resetCode = await prisma.passwordResetCode.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!resetCode || !resetCode.user) {
      return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 400 });
    }

    if (resetCode.lockedAt || resetCode.attempts >= resetCode.maxAttempts) {
      return NextResponse.json(
        { error: "This code is locked. Please request a new verification code." },
        { status: 423 },
      );
    }

    if (resetCode.expiresAt < new Date()) {
      await prisma.passwordResetCode.update({
        where: { id: resetCode.id },
        data: { consumedAt: new Date() },
      });
      return NextResponse.json(
        { error: "This code has expired. Please request a new one." },
        { status: 400 },
      );
    }

    const expectedHash = hashPasswordResetSecret(`${email}:${parsed.data.code}`);
    if (expectedHash !== resetCode.codeHash) {
      const attempts = resetCode.attempts + 1;
      await prisma.passwordResetCode.update({
        where: { id: resetCode.id },
        data: {
          attempts,
          lockedAt: attempts >= resetCode.maxAttempts ? new Date() : undefined,
        },
      });

      await logPasswordResetEvent({
        action:
          attempts >= resetCode.maxAttempts
            ? "PASSWORD_RESET_CODE_LOCKED"
            : "PASSWORD_RESET_CODE_FAILED",
        userId: resetCode.userId ?? undefined,
        email,
        ipAddress,
        userAgent,
        metadata: { attempts },
      });

      return NextResponse.json(
        {
          error:
            attempts >= resetCode.maxAttempts
              ? "Too many invalid attempts. Please request a new code."
              : "Invalid verification code",
          attemptsRemaining: Math.max(resetCode.maxAttempts - attempts, 0),
        },
        { status: attempts >= resetCode.maxAttempts ? 423 : 400 },
      );
    }

    const sessionToken = generateResetSessionToken();
    await prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: {
        verifiedAt: new Date(),
        resetSessionTokenHash: hashPasswordResetSecret(sessionToken),
      },
    });

    await logPasswordResetEvent({
      action: "PASSWORD_RESET_CODE_VERIFIED",
      userId: resetCode.user.id,
      email,
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json({ success: true, redirectTo: "/reset-password/new" });
    response.cookies.set(PASSWORD_RESET_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PASSWORD_RESET_SESSION_TTL_MS / 1000,
    });
    return response;
  } catch (error) {
    console.error("Password reset verification error:", error);
    return NextResponse.json({ error: "Unable to verify this code" }, { status: 500 });
  }
}
