import { NextRequest } from "next/server";
import { getSystemAuditLogs } from "@/actions/admin";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const page = Number(req.nextUrl.searchParams.get("page")) || 1;
    const data = await getSystemAuditLogs(page);
    return successResponse(data);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch audit logs");
  }
}
