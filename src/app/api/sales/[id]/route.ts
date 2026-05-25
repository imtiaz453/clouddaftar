import { NextRequest, NextResponse } from "next/server";
import {
  getSale,
  updateSale,
  refundSale,
  convertSaleToDraft,
  convertSaleDocument,
} from "@/actions/sales";
import { saleUpdateSchema } from "@/lib/validations";
import { z } from "zod";

const refundItemsSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1),
    }),
  )
  .optional();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sale = await getSale(id);
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: sale });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sale" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await req.json();
    const parsed = saleUpdateSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid sale data" },
        { status: 400 },
      );
    }

    const sale = await updateSale(id, parsed.data);
    return NextResponse.json({ success: true, data: sale });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update sale" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action, items } = await req.json();

    if (action === "refund") {
      const parsedItems = refundItemsSchema.safeParse(items);
      if (!parsedItems.success) {
        return NextResponse.json({ error: "Invalid refund items" }, { status: 400 });
      }

      const sale = await refundSale(id, parsedItems.data);
      return NextResponse.json({ success: true, data: sale });
    }

    if (action === "convert-to-draft") {
      await convertSaleToDraft(id);
      return NextResponse.json({ success: true, message: "Converted to draft" });
    }

    if (action === "convert-to-proforma") {
      const sale = await convertSaleDocument(id, "PROFORMA");
      return NextResponse.json({
        success: true,
        data: sale,
        message: "Sales order converted to proforma invoice",
      });
    }

    if (action === "convert-to-invoice") {
      const sale = await convertSaleDocument(id, "COMPLETED");
      return NextResponse.json({
        success: true,
        data: sale,
        message: "Document converted to invoice",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process sale" },
      { status: 500 },
    );
  }
}
