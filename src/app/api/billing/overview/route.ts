import { getBillingOverview } from "@/actions/billing";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const data = await getBillingOverview();
    return successResponse(data);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch billing");
  }
}
