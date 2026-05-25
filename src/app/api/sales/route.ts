import { NextRequest } from "next/server";
import { getSales, createSale } from "@/actions/sales";
import { successResponse, errorResponse } from "@/lib/api";
import { saleCreateSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sales = await getSales({
      search: searchParams.get("search") || undefined,
      customerId: searchParams.get("customerId") || undefined,
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 50,
    });
    return successResponse(sales);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch sales");
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const parsed = saleCreateSchema.safeParse(data);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || "Invalid sale data", 400);
    }

    const sale = await createSale(parsed.data);
    return successResponse(sale, "Sale completed successfully");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create sale");
  }
}
