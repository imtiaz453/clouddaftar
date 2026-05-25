import { NextRequest } from "next/server";
import { getPurchases, createPurchase } from "@/actions/purchases";
import { successResponse, errorResponse } from "@/lib/api";
import { purchaseCreateSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const purchases = await getPurchases({
      search: searchParams.get("search") || undefined,
      supplierId: searchParams.get("supplierId") || undefined,
      status: status || undefined,
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 50,
    });
    return successResponse(purchases);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch purchases");
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const parsed = purchaseCreateSchema.safeParse(data);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || "Invalid purchase data", 400);
    }

    const purchase = await createPurchase(parsed.data);
    return successResponse(purchase, "Purchase recorded successfully");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create purchase");
  }
}
