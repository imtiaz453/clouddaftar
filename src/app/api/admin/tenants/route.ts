import { NextRequest } from "next/server";
import { getTenantsList } from "@/actions/admin";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search") || undefined;
    const page = Number(req.nextUrl.searchParams.get("page")) || 1;
    const data = await getTenantsList(search, page);
    return successResponse(data);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch tenants");
  }
}
