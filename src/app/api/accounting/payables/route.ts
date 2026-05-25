import { NextRequest, NextResponse } from "next/server";
import { getPayables } from "@/actions/accounting";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const payables = await getPayables({
      purchaseId: searchParams.get("purchaseId") || undefined,
      search: searchParams.get("search") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      status: searchParams.get("status") || undefined,
      overdueOnly: searchParams.get("overdueOnly") === "true",
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 20,
    });

    return NextResponse.json({ success: true, data: payables });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch payables" },
      { status: 500 },
    );
  }
}
