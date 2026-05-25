import { NextResponse } from "next/server";
import { deleteSalaryAdjustment } from "@/actions/payroll";

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteSalaryAdjustment(id);
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}
