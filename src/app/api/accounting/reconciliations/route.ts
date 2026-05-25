import { NextRequest, NextResponse } from "next/server";
import { createReconciliation, getReconciliations } from "@/actions/accounting";
import { z } from "zod";

const reconciliationCreateSchema = z.object({
  type: z.enum(["CUSTOMER", "SUPPLIER"]),
  referenceId: z.string().min(1).optional(),
  referenceType: z.enum(["CUSTOMER", "SUPPLIER"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const data = await getReconciliations({
      type: searchParams.get("type") || undefined,
      status: searchParams.get("status") || undefined,
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 50,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch reconciliations" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = reconciliationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid reconciliation data" },
        { status: 400 },
      );
    }

    const data = await createReconciliation(parsed.data);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create reconciliation" },
      { status: 500 },
    );
  }
}
