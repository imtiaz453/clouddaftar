import { NextRequest, NextResponse } from "next/server";
import { getStockLocationDetail } from "@/actions/inventory";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getStockLocationDetail(id);
    if (!data) {
      return NextResponse.json({ success: false, error: "Location not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}
