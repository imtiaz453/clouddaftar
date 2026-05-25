import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists for this email, a verification code has been sent.";

export const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
export const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_SESSION_COOKIE = "cloud_daftar_password_reset";
export const PASSWORD_RESET_SESSION_TTL_MS = 10 * 60 * 1000;

export function normalizeResetEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || headers.get("x-real-ip") || "unknown";
}

export function generateVerificationCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateResetSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashPasswordResetSecret(value: string) {
  const pepper = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "cloud-daftar-dev";
  return crypto.createHmac("sha256", pepper).update(value).digest("hex");
}

export async function logPasswordResetEvent(params: {
  action: string;
  userId?: string;
  email: string;
  ipAddress?: string;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.systemAuditLog.create({
      data: {
        action: params.action,
        entity: "PasswordReset",
        entityId: params.userId,
        createdById: params.userId,
        metadata: {
          email: params.email,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          ...(params.metadata ?? {}),
        },
      },
    });
  } catch (error) {
    console.error("Failed to audit password reset event", error);
  }
}

function getMailFrom() {
  const name = process.env.MAIL_FROM_NAME || "CloudDaftar Password Recovery";
  const email = process.env.MAIL_FROM_EMAIL || "reset@cloud-daftar.com";
  return `"${name.replace(/"/g, "")}" <${email}>`;
}

function getBrevoTransport() {
  const host = process.env.BREVO_SMTP_HOST;
  const port = Number(process.env.BREVO_SMTP_PORT || 587);
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Brevo SMTP environment variables are not configured");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function renderPasswordResetEmail(params: { name?: string | null; code: string }) {
  const safeName = params.name?.trim() || "there";
  const codeDigits = params.code.split("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>CloudDaftar Password Recovery</title>
  </head>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5eaf2;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#0f766e;padding:28px 32px;color:#ffffff;">
                <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">CloudDaftar</div>
                <h1 style="margin:8px 0 0;font-size:26px;line-height:1.25;">Password recovery code</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${safeName},</p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Use this verification code to reset your CloudDaftar password. It expires in 10 minutes.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 24px;">
                  <tr>
                    ${codeDigits
                      .map(
                        (digit) =>
                          `<td style="padding:0 4px;"><div style="width:44px;height:52px;line-height:52px;text-align:center;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-size:28px;font-weight:700;letter-spacing:0;color:#0f172a;">${digit}</div></td>`,
                      )
                      .join("")}
                  </tr>
                </table>
                <div style="border:1px solid #fde68a;background:#fffbeb;border-radius:8px;padding:14px 16px;color:#92400e;font-size:14px;line-height:1.5;">
                  If you did not request this reset, ignore this email.
                </div>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">For production sending, verify the sending domain in Brevo and publish SPF, DKIM, and DMARC records for reset@cloud-daftar.com.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name?: string | null;
  code: string;
}) {
  const transporter = getBrevoTransport();
  await transporter.sendMail({
    from: getMailFrom(),
    to: params.to,
    subject: "Your CloudDaftar password recovery code",
    text: `Your CloudDaftar password recovery code is ${params.code}. It expires in 10 minutes. If you did not request this reset, ignore this email.`,
    html: renderPasswordResetEmail(params),
  });
}

export async function invalidatePasswordResetCodes(email: string) {
  await prisma.passwordResetCode.updateMany({
    where: {
      email,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });
}
