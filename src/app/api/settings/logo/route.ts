import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { successResponse, errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCompanyAuth();
    const { logo } = await req.json();

    if (!logo) {
      return errorResponse("Logo URL is required");
    }

    await prisma.company.update({
      where: { id: user.companyId },
      data: { logo },
    });

    return successResponse(null, "Logo updated");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update logo");
  }
}
