import { NextRequest, NextResponse } from "next/server";
import { paySupplier } from "@/actions/accounting";
import { supplierPaymentSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = supplierPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payment data" },
        { status: 400 },
      );
    }

    const payment = await paySupplier(parsed.data);
    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record supplier payment";
    const status =
      message.includes("exceed") ||
      message.includes("invalid") ||
      message.includes("required") ||
      message.includes("positive") ||
      message.includes("outstanding") ||
      message.includes("not found")
        ? 400
        : 500;
    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
