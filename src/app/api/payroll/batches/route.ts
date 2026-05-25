import { NextResponse } from "next/server";
import { getBatches, createBatch } from "@/actions/payroll";

export async function GET() {
  try {
    const data = await getBatches();
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await createBatch(body);
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}
