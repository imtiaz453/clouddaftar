import { NextRequest, NextResponse } from "next/server";
import { getStockLedgerV2 } from "@/actions/inventory";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const data = await getStockLedgerV2({
      productId: sp.get("productId") || undefined,
      locationId: sp.get("locationId") || undefined,
      movementType: sp.get("movementType") || undefined,
      dateFrom: sp.get("dateFrom") || undefined,
      dateTo: sp.get("dateTo") || undefined,
      reference: sp.get("reference") || undefined,
      referenceId: sp.get("referenceId") || undefined,
      page: Number(sp.get("page")) || 1,
      pageSize: Number(sp.get("pageSize")) || 50,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch ledger" },
      { status: 500 },
    );
  }
}
