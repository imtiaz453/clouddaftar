import { NextResponse } from "next/server";
import { getContract, updateContract } from "@/actions/payroll";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = await getContract(id);
    if (!data) return NextResponse.json({ success: false, error: "Contract not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const data = await updateContract(id, body);
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}
