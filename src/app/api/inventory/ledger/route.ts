import { NextRequest, NextResponse } from "next/server";
import { getInventoryLedger } from "@/actions/inventory";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const data = await getInventoryLedger({
      productId: url.searchParams.get("productId") || undefined,
      type: url.searchParams.get("type") || undefined,
      dateFrom: url.searchParams.get("dateFrom") || undefined,
      dateTo: url.searchParams.get("dateTo") || undefined,
      page: parseInt(url.searchParams.get("page") || "1"),
      pageSize: parseInt(url.searchParams.get("pageSize") || "50"),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch inventory ledger" },
      { status: 500 },
    );
  }
}
