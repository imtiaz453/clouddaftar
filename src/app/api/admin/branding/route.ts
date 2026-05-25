import { NextRequest } from "next/server";
import { getBrandingForAdmin, updateBranding } from "@/actions/branding";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const data = await getBrandingForAdmin();
    return successResponse(data);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch branding");
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const result = await updateBranding(data);
    return successResponse(result, "Branding updated");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update branding");
  }
}
