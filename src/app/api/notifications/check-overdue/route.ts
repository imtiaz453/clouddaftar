import { NextResponse } from "next/server";
import { checkOverduePayments } from "@/actions/accounting";

export async function POST() {
  try {
    const result = await checkOverduePayments();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check overdue payments" },
      { status: 500 },
    );
  }
}
