import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCompanyAiInsights } from "@/lib/ai-insights";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const companyId = (session?.user as { companyId?: string })?.companyId;
  if (!companyId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "/";
  const data = await getCompanyAiInsights(companyId, path);
  return NextResponse.json({ success: true, data });
}
