import { NextRequest, NextResponse } from "next/server";
import { getPaymentHistoryReport } from "@/actions/accounting";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const data = await getPaymentHistoryReport({
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      customerId: searchParams.get("customerId") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      paymentType: (searchParams.get("paymentType") as "customer" | "supplier" | null) || undefined,
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 20,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch payment report" },
      { status: 500 },
    );
  }
}
