import { getAdminDashboard } from "@/actions/admin";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const data = await getAdminDashboard();
    return successResponse(data);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch dashboard");
  }
}
