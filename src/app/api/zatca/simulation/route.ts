import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api";
import {
  generateZatcaSettingsCsr,
  onboardZatcaDevice,
  testZatcaConnection,
} from "@/actions/zatca";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "generate-csr") {
      return successResponse(await generateZatcaSettingsCsr(), "ZATCA CSR generated");
    }
    if (body.action === "onboard-device" || body.action === "compliance-csid") {
      return successResponse(await onboardZatcaDevice(), "ZATCA device onboarding started");
    }
    if (body.action === "test-connection") {
      return successResponse(await testZatcaConnection(), "ZATCA connection test completed");
    }
    return errorResponse("Unknown ZATCA Simulation action", 400);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "ZATCA Simulation action failed",
      400,
    );
  }
}
