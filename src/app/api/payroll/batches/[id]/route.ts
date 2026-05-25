import { NextResponse } from "next/server";
import { updateBatchStatus, draftBatchPayslips, deleteBatch } from "@/actions/payroll";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    if (body.status) {
      const data = await updateBatchStatus(id, body.status);
      return NextResponse.json({ success: true, data });
    }
    const data = await draftBatchPayslips(id);
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteBatch(id);
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}
