import { NextRequest } from "next/server";
import { adjustStock } from "@/actions/inventory";
import { successResponse, errorResponse } from "@/lib/api";
import { stockAdjustSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const parsed = stockAdjustSchema.safeParse(data);

    if (!parsed.success) {
      return errorResponse("Invalid stock adjustment data", 400);
    }

    const result = await adjustStock(parsed.data);
    return successResponse(result, "Stock adjusted");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to adjust stock", 400);
  }
}
