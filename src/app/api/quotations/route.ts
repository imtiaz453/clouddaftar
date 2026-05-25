import { NextRequest, NextResponse } from "next/server";
import { getQuotations, createQuotation } from "@/actions/quotations";
import { quotationCreateSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const data = await getQuotations({
      search: url.searchParams.get("search") || undefined,
      customerId: url.searchParams.get("customerId") || undefined,
      status: url.searchParams.get("status") || undefined,
      page: parseInt(url.searchParams.get("page") || "1"),
      pageSize: parseInt(url.searchParams.get("pageSize") || "20"),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quotations" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = quotationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid quotation data" },
        { status: 400 },
      );
    }

    const quotation = await createQuotation(parsed.data);
    return NextResponse.json({ success: true, data: quotation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create quotation" },
      { status: 500 },
    );
  }
}
