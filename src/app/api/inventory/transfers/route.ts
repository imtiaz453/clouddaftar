import { transferStock } from "@/actions/inventory";
import { successResponse, errorResponse } from "@/lib/api";
import { stockTransferSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const data = await req.json().catch(() => null);
    const parsed = stockTransferSchema.safeParse(data);
    if (!parsed.success) {
      return errorResponse(
        parsed.error.errors[0]?.message || "Invalid stock transfer data",
        400,
      );
    }

    const result = await transferStock(parsed.data);
    return successResponse(result, "Stock transferred");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to transfer stock", 400);
  }
}
