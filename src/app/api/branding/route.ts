import { getBranding } from "@/actions/branding";
import { successResponse } from "@/lib/api";

export async function GET() {
  const data = await getBranding();
  return successResponse(data);
}
