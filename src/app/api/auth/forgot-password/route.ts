import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import {
  PASSWORD_RESET_CODE_TTL_MS,
  PASSWORD_RESET_GENERIC_MESSAGE,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_RESEND_COOLDOWN_MS,
  generateVerificationCode,
  getClientIp,
  hashPasswordResetSecret,
  invalidatePasswordResetCodes,
  logPasswordResetEvent,
  normalizeResetEmail,
  sendPasswordResetEmail,
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

  const headers = req.headers;
  const ipAddress = getClientIp(headers);
  const userAgent = headers.get("user-agent");

  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const email = normalizeResetEmail(parsed.data.email);
    const ipLimit = rateLimit(`password-reset:request:ip:${ipAddress}`, 8, 15 * 60 * 1000);
    const emailLimit = rateLimit(`password-reset:request:email:${email}`, 3, 15 * 60 * 1000);

    if (!ipLimit.success || !emailLimit.success) {
      await logPasswordResetEvent({
        action: "PASSWORD_RESET_RATE_LIMITED",
        email,
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: "Too many reset requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    const existingCode = await prisma.passwordResetCode.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { resendAvailableAt: true },
    });

    if (existingCode && existingCode.resendAvailableAt > new Date()) {
      return NextResponse.json({
        message: PASSWORD_RESET_GENERIC_MESSAGE,
        resendAfterSeconds: Math.ceil(
          (existingCode.resendAvailableAt.getTime() - Date.now()) / 1000,
        ),
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (user?.isActive) {
      const code = generateVerificationCode();
      const now = new Date();

      await invalidatePasswordResetCodes(email);
      await prisma.passwordResetCode.create({
        data: {
          email,
          userId: user.id,
          codeHash: hashPasswordResetSecret(`${email}:${code}`),
          attempts: 0,
          maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_CODE_TTL_MS),
          resendAvailableAt: new Date(now.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS),
          requestIp: ipAddress,
          userAgent,
        },
      });

      try {
        await sendPasswordResetEmail({ to: user.email, name: user.name, code });
        await logPasswordResetEvent({
          action: "PASSWORD_RESET_CODE_SENT",
          userId: user.id,
          email,
          ipAddress,
          userAgent,
        });
      } catch (error) {
        console.error("Failed to send password reset email", error);
        await logPasswordResetEvent({
          action: "PASSWORD_RESET_EMAIL_FAILED",
          userId: user.id,
          email,
          ipAddress,
          userAgent,
          metadata: { reason: error instanceof Error ? error.message : "Unknown error" },
        });
      }
    } else {
      await logPasswordResetEvent({
        action: "PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL",
        email,
        ipAddress,
        userAgent,
      });
    }

    return NextResponse.json({
      message: PASSWORD_RESET_GENERIC_MESSAGE,
      resendAfterSeconds: PASSWORD_RESET_RESEND_COOLDOWN_MS / 1000,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Unable to process this request" }, { status: 500 });
  }
}
