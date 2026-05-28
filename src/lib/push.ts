import webpush from "web-push";
import { prisma } from "@/lib/prisma";

function getVapidSubject(): string {
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@clouddaftar.com";
  if (subject.startsWith("mailto:") || subject.startsWith("http://") || subject.startsWith("https://")) {
    return subject;
  }
  return `mailto:${subject}`;
}

function ensureVapidSetup(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
    return true;
  } catch {
    return false;
  }
}

interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

async function sendToSubscriptions(subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[], payload: PushPayload): Promise<void> {
  if (subscriptions.length === 0) return;

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      ),
    ),
  );

  const expiredIds: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const err = result.reason as { statusCode?: number };
      if (err.statusCode === 404 || err.statusCode === 410) {
        expiredIds.push(subscriptions[index].id);
      }
    }
  });

  if (expiredIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: expiredIds } },
    });
  }
}

export async function sendPushNotification(
  companyId: string,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapidSetup()) return;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { companyId, userId },
  });
  await sendToSubscriptions(subscriptions, payload);
}

export async function sendPushNotificationToCompany(
  companyId: string,
  payload: PushPayload,
  excludeUserId?: string,
): Promise<void> {
  if (!ensureVapidSetup()) return;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      companyId,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
  });
  await sendToSubscriptions(subscriptions, payload);
}

/** Sends to the acting user AND all OWNER/ADMIN members of the company */
export async function sendPushNotificationWithAdmins(
  companyId: string,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapidSetup()) return;

  const adminMemberships = await prisma.companyMembership.findMany({
    where: {
      companyId,
      isActive: true,
      role: { in: ["OWNER", "ADMIN"] },
      userId: { not: userId },
    },
    select: { userId: true },
  });

  const adminIds = adminMemberships.map((m) => m.userId);

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      companyId,
      OR: [
        { userId },
        ...(adminIds.length > 0 ? [{ userId: { in: adminIds } }] : []),
      ],
    },
  });

  await sendToSubscriptions(subscriptions, payload);
}
