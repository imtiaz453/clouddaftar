import { NextResponse } from "next/server";
import { createCertification, deleteCertification } from "@/actions/employees-hr";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await createCertification({ ...body, issueDate: body.issueDate ? new Date(body.issueDate) : undefined, expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined });
    return NextResponse.json({ success: true, data });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    await deleteCertification(id);
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
}
