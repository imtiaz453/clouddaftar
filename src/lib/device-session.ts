import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

const ACTIVE_LOGIN_DAYS = 30;

function firstHeader(
  headers: Headers | Record<string, string | string[] | undefined>,
  key: string,
) {
  if (headers instanceof Headers) return headers.get(key) || "";
  const value = headers[key] || headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export function detectDevice(userAgent = "") {
  const ua = userAgent || "";
  const os = /Windows NT/i.test(ua)
    ? "Windows"
    : /Mac OS X/i.test(ua)
      ? "macOS"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/i.test(ua)
          ? "iOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Unknown OS";

  const browser = /Edg\//i.test(ua)
    ? "Microsoft Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Unknown browser";

  const modelMatch =
    ua.match(/\((?:[^;]+;\s*)?(iPhone|iPad|iPod|[^;)]+ Build\/[^;)]+|Android [^;)]+)/i) ||
    ua.match(/\((Windows NT [^;)]+|Macintosh; [^;)]+|X11; [^;)]+)\)/i);
  const rawModel = modelMatch?.[1]?.replace(/\s*Build\/.+$/i, "").replace(/^Macintosh;\s*/i, "");
  const deviceModel =
    rawModel || (os === "Windows" || os === "macOS" || os === "Linux" ? `${os} computer` : os);
  const deviceLabel = [deviceModel, browser].filter(Boolean).join(" - ");

  return { os, browser, deviceModel, deviceLabel };
}

export function requestDeviceInfo(
  headers: Headers | Record<string, string | string[] | undefined>,
) {
  const userAgent = firstHeader(headers, "user-agent");
  const forwardedFor = firstHeader(headers, "x-forwarded-for");
  const realIp = firstHeader(headers, "x-real-ip");
  const ipAddress = (forwardedFor.split(",")[0] || realIp || "").trim() || null;
  return { ...detectDevice(userAgent), userAgent, ipAddress };
}

export async function createActiveLoginSession(
  userId: string,
  device: ReturnType<typeof requestDeviceInfo>,
) {
  const now = new Date();
  await prisma.activeLoginSession.deleteMany({
    where: { userId, expiresAt: { lt: now } },
  });

  return prisma.activeLoginSession.create({
    data: {
      id: randomUUID(),
      userId,
      deviceLabel: device.deviceLabel,
      deviceModel: device.deviceModel,
      browser: device.browser,
      os: device.os,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
      expiresAt: new Date(now.getTime() + ACTIVE_LOGIN_DAYS * 86_400_000),
    },
  });
}
