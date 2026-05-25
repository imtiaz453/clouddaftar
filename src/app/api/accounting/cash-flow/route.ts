import { NextRequest, NextResponse } from "next/server";
import { getCashFlow } from "@/actions/accounting";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const data = await getCashFlow({
      dateFrom: url.searchParams.get("dateFrom") || undefined,
      dateTo: url.searchParams.get("dateTo") || undefined,
      page: parseInt(url.searchParams.get("page") || "1"),
      pageSize: parseInt(url.searchParams.get("pageSize") || "50"),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch cash flow" },
      { status: 500 },
    );
  }
}
