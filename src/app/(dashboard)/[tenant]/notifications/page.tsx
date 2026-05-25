import { requireCompanyAuth } from "@/lib/auth-helper";
import { prisma } from "@/lib/prisma";
import { NotificationsClient } from "@/features/notifications/notifications-client";
import { PageHeader } from "@/components/shared/page-header";

export default async function TenantNotificationsPage() {
  const user = await requireCompanyAuth();
  const { companyId, id: userId } = user;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { companyId, userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      skip: 0,
    }),
    prisma.notification.count({ where: { companyId, userId } }),
    prisma.notification.count({ where: { companyId, userId, isRead: false } }),
  ]);

  const data = {
    data: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    unreadCount,
    page: 1,
    pageSize: 20,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="View and manage your notifications" />
      <NotificationsClient initialData={data as any} />
    </div>
  );
}
