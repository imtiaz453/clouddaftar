import { NextRequest } from "next/server";
import { getCompanyDetail, suspendTenant, reactivateTenant, extendSubscription, adminChangePlan } from "@/actions/admin";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const company = await getCompanyDetail(id);
    if (!company) return errorResponse("Company not found", 404);
    return successResponse(company);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch company");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action, ...data } = await req.json();

    switch (action) {
      case "suspend":
        return successResponse(await suspendTenant(id));
      case "reactivate":
        return successResponse(await reactivateTenant(id));
      case "extend":
        return successResponse(await extendSubscription(id, data.days));
      case "change-plan":
        return successResponse(await adminChangePlan(id, data.planId));
      default:
        return errorResponse("Invalid action");
    }
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed");
  }
}
