import { NextRequest } from "next/server";
import { createProductLot } from "@/actions/inventory";
import { successResponse, errorResponse } from "@/lib/api";
import { productLotSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = productLotSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || "Invalid lot data", 400);
    }
    const lot = await createProductLot(parsed.data);
    return successResponse(lot, "Traceability record created");
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create traceability record",
      400,
    );
  }
}
