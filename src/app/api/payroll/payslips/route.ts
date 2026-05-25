import { NextRequest, NextResponse } from "next/server";
import { getPayslips, draftPayslip } from "@/actions/payroll";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const data = await getPayslips({
      status: searchParams.get("status") || undefined,
      employeeId: searchParams.get("employeeId") || undefined,
      batchId: searchParams.get("batchId") || undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
    });
    return NextResponse.json({ success: true, ...data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await draftPayslip(body);
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}
