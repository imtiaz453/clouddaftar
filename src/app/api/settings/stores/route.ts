import { NextResponse } from "next/server";
import { requireCompanyAuth } from "@/lib/auth-helper";
import { createWarehouse, updateWarehouse, toggleWarehouseStatus, deleteWarehouse } from "@/actions/locations";

export async function POST(req: Request) {
  try {
    await requireCompanyAuth();
    const body = await req.json();
    const warehouse = await createWarehouse(body);
    return NextResponse.json({ success: true, data: warehouse });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireCompanyAuth();
    const body = await req.json();
    const warehouse = await updateWarehouse(body);
    return NextResponse.json({ success: true, data: warehouse });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireCompanyAuth();
    const { id, isActive } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Store ID required" }, { status: 400 });
    const warehouse = await toggleWarehouseStatus(id, isActive);
    return NextResponse.json({ success: true, data: warehouse });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireCompanyAuth();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Store ID required" }, { status: 400 });
    await deleteWarehouse(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
