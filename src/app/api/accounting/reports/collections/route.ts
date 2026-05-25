import { NextRequest, NextResponse } from "next/server";
import { getCollectionReport } from "@/actions/accounting";

export async function GET(req: NextRequest) {
  try {
    const dateFrom = req.nextUrl.searchParams.get("dateFrom");
    const dateTo = req.nextUrl.searchParams.get("dateTo");
    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
    }

    const data = await getCollectionReport(dateFrom, dateTo);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch collection report" },
      { status: 500 },
    );
  }
}
