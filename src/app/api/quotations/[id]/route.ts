import { NextRequest, NextResponse } from "next/server";
import {
  getQuotation,
  updateQuotation,
  updateQuotationStatus,
  convertQuotationToSale,
  deleteQuotation,
} from "@/actions/quotations";
import { quotationUpdateSchema } from "@/lib/validations";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const quotation = await getQuotation(id);
    return NextResponse.json({ success: true, data: quotation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quotation" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = quotationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid quotation data" },
        { status: 400 },
      );
    }

    const quotation = await updateQuotation(id, parsed.data);
    return NextResponse.json({ success: true, data: quotation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update quotation" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action } = await req.json();

    switch (action) {
      case "send":
        await updateQuotationStatus(id, "SENT");
        return NextResponse.json({ success: true, message: "Quotation sent" });
      case "accept":
        await updateQuotationStatus(id, "ACCEPTED");
        return NextResponse.json({ success: true, message: "Quotation accepted" });
      case "reject":
        await updateQuotationStatus(id, "REJECTED");
        return NextResponse.json({ success: true, message: "Quotation rejected" });
      case "convert":
        const sale = await convertQuotationToSale(id);
        return NextResponse.json({
          success: true,
          data: sale,
          message: "Quotation converted to sales order",
        });
      case "delete":
        await deleteQuotation(id);
        return NextResponse.json({ success: true, message: "Quotation deleted" });
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process quotation" },
      { status: 500 },
    );
  }
}
