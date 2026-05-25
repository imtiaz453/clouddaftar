import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helper";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.companyId) return successResponse({});

    const theme = await prisma.themeSettings.findUnique({
      where: { companyId: user.companyId },
    });
    return successResponse(theme || {});
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch theme", 401);
  }
}
