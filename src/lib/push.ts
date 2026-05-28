import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidKeys = {
  subject: process.env.VAPID_SUBJECT || "mailto:admin@clouddaftar.com",
  publicKey: process.env.VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || "",
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);
}

interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

export async function sendPushNotification(
  companyId: string,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidKeys.publicKey || !vapidKeys.privateKey) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { companyId, userId },
  });

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

export async function sendPushNotificationToCompany(
  companyId: string,
  payload: PushPayload,
  excludeUserId?: string,
): Promise<void> {
  if (!vapidKeys.publicKey || !vapidKeys.privateKey) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      companyId,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
  });

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
