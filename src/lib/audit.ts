import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@prisma/client";

export async function createAuditLog(params: {
  userId: string;
  companyId: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        companyId: params.companyId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: (params.metadata ?? {}) as any,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function logActivity(params: {
  userId: string;
  companyId?: string;
  action: string;
  details?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        companyId: params.companyId,
        action: params.action,
        details: params.details,
      },
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export async function createNotification(params: {
  companyId: string;
  userId: string;
  title: string;
  message?: string;
  type?: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
  link?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type ?? "INFO",
        link: params.link,
      },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function createCompanyNotification(params: {
  companyId: string;
  title: string;
  message?: string;
  type?: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
  link?: string;
}) {
  try {
    const members = await prisma.companyMembership.findMany({
      where: {
        companyId: params.companyId,
        isActive: true,
        user: { isActive: true },
      },
      select: { userId: true },
    });
    if (members.length === 0) return;

    await prisma.notification.createMany({
      data: members.map((member) => ({
        companyId: params.companyId,
        userId: member.userId,
        title: params.title,
        message: params.message,
        type: params.type ?? "INFO",
        link: params.link,
      })),
    });
  } catch (error) {
    console.error("Failed to create company notification:", error);
  }
}
