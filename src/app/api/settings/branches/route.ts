import { NextResponse } from "next/server";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createBranch, updateBranch, toggleBranchStatus, deleteBranch } from "@/actions/locations";

export async function POST(req: Request) {
  try {
    await requireCompanyAuth();
    const body = await req.json();
    const branch = await createBranch(body);
    return NextResponse.json({ success: true, data: branch });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireCompanyAuth();
    const body = await req.json();
    const branch = await updateBranch(body);
    return NextResponse.json({ success: true, data: branch });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireCompanyAuth();
    const { id, isActive } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Branch ID required" }, { status: 400 });
    const branch = await toggleBranchStatus(id, isActive);
    return NextResponse.json({ success: true, data: branch });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireCompanyAuth();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Branch ID required" }, { status: 400 });
    await deleteBranch(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
