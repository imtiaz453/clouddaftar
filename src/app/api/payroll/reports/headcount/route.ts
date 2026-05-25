import { NextResponse } from "next/server";
import { getHeadcountReport } from "@/actions/payroll";

export async function GET() {
  try {
    const data = await getHeadcountReport();
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}
