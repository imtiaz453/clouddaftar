import { NextRequest, NextResponse } from "next/server";
import { getPayableDetail } from "@/actions/accounting";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const purchase = await getPayableDetail(id);
    return NextResponse.json({ success: true, data: { purchase } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch payable" },
      { status: error instanceof Error && error.message === "Purchase not found" ? 404 : 500 },
    );
  }
}
