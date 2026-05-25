import { NextRequest, NextResponse } from "next/server";
import { getOutstandingReport } from "@/actions/accounting";

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type") === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER";
    const data = await getOutstandingReport(type);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch outstanding report" },
      { status: 500 },
    );
  }
}
