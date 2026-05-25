import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {
      companyId: user.companyId,
      userId: user.id,
    };
    if (unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where: where as any }),
      prisma.notification.count({
        where: { companyId: user.companyId, userId: user.id, isRead: false },
      }),
    ]);

    return successResponse({
      data: notifications,
      total,
      unreadCount,
      page,
      pageSize,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch notifications");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { id, markAllRead } = await req.json();

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { companyId: user.companyId, userId: user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (id) {
      await prisma.notification.updateMany({
        where: { id, companyId: user.companyId, userId: user.id },
        data: { isRead: true },
      });
    }

    return successResponse(null, "Notifications updated");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update notifications");
  }
}
