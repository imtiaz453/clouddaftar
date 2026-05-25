import { NextResponse } from "next/server";
import { getGeneralLedger, getTrialBalance, getBalanceSheet, getProfitLoss, getDayBook } from "@/actions/accounting-coa";

export async function GET(req: Request, context: { params: Promise<{ report: string }> }) {
  try {
    const { searchParams } = new URL(req.url);
    const { report } = await context.params;
    let data;
    switch (report) {
      case "gl":
        data = await getGeneralLedger({
          accountId: searchParams.get("accountId") || undefined,
          dateFrom: searchParams.get("dateFrom") || undefined,
          dateTo: searchParams.get("dateTo") || undefined,
          page: parseInt(searchParams.get("page") || "1"),
          pageSize: parseInt(searchParams.get("pageSize") || "50"),
        });
        break;
      case "trial-balance":
        data = await getTrialBalance(searchParams.get("dateFrom") || undefined, searchParams.get("dateTo") || undefined);
        break;
      case "balance-sheet":
        data = await getBalanceSheet(searchParams.get("dateTo") || undefined);
        break;
      case "profit-loss":
        data = await getProfitLoss(searchParams.get("dateFrom") || undefined, searchParams.get("dateTo") || undefined);
        break;
      case "day-book":
        data = await getDayBook(searchParams.get("dateFrom") || undefined, searchParams.get("dateTo") || undefined, searchParams.get("journalType") || undefined);
        break;
      default:
        return NextResponse.json({ success: false, error: "Unknown report" }, { status: 400 });
    }
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}
