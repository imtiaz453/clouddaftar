import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

export function successResponse<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, message });
}

export function errorResponse(error: string, status: number = 400): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status });
}

export function unauthorizedResponse(): NextResponse<ApiResponse> {
  return errorResponse("Unauthorized", 401);
}

export function notFoundResponse(entity: string = "Resource"): NextResponse<ApiResponse> {
  return errorResponse(`${entity} not found`, 404);
}

export function forbiddenResponse(): NextResponse<ApiResponse> {
  return errorResponse("Forbidden", 403);
}
