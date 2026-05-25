import { NextRequest, NextResponse } from "next/server";
import { getAgingReport } from "@/actions/accounting";

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type") === "PAYABLE" ? "PAYABLE" : "RECEIVABLE";
    const data = await getAgingReport(type);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch aging report" },
      { status: 500 },
    );
  }
}
