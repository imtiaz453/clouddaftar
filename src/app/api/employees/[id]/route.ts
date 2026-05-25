import { NextResponse } from "next/server";
import { updateEmployeeProfile, updateEmployeeRole } from "@/actions/employees-hr";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { id } = await context.params;
    await updateEmployeeProfile(id, body);
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { id } = await context.params;
    if (body.membershipId) {
      await updateEmployeeRole(body.membershipId, body.role, body.branchId);
    }
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}
