import { NextRequest, NextResponse } from "next/server";
import { getIncomeExpense } from "@/actions/accounting";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const data = await getIncomeExpense({
      year: parseInt(url.searchParams.get("year") || String(new Date().getFullYear())),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch income/expense" },
      { status: 500 },
    );
  }
}
