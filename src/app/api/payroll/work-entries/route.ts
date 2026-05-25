import { NextRequest, NextResponse } from "next/server";
import { getWorkEntries, upsertWorkEntry } from "@/actions/payroll";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const data = await getWorkEntries({
      employeeId: searchParams.get("employeeId") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await upsertWorkEntry(body);
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}
