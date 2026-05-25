import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { successResponse, errorResponse } from "@/lib/api";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { companyId } = user;
    const { autoRenew } = await req.json();

    const sub = await prisma.tenantSubscription.findUnique({
      where: { companyId },
    });
    if (!sub) return errorResponse("No subscription found", 404);

    await prisma.tenantSubscription.update({
      where: { companyId },
      data: { autoRenew },
    });

    return successResponse({ autoRenew }, "Auto-renew updated");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update auto-renew");
  }
}
