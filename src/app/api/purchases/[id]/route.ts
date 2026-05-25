import { NextRequest, NextResponse } from "next/server";
import {
  getPurchase,
  updatePurchase,
  returnPurchase,
  convertPurchaseToDraft,
} from "@/actions/purchases";
import { purchaseUpdateSchema } from "@/lib/validations";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const purchase = await getPurchase(id);
    if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: purchase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await req.json();
    const parsed = purchaseUpdateSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid purchase data" },
        { status: 400 },
      );
    }

    const purchase = await updatePurchase(id, parsed.data);
    return NextResponse.json({ success: true, data: purchase });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action } = await req.json();
    if (action === "return") {
      await returnPurchase(id);
      return NextResponse.json({ success: true });
    }
    if (action === "convert-to-draft") {
      await convertPurchaseToDraft(id);
      return NextResponse.json({ success: true, message: "Converted to draft" });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
