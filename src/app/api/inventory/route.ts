import { NextRequest } from "next/server";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
} from "@/actions/inventory";
import { successResponse, errorResponse } from "@/lib/api";
import { productSchema, productUpdateSchema, stockAdjustSchema } from "@/lib/validations";
import { z } from "zod";

const deleteProductSchema = z.object({
  id: z.string().min(1, "Product ID is required"),
});

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const products = await getProducts({
      search: searchParams.get("search") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 50,
    });
    return successResponse(products);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch products");
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const parsed = productSchema.safeParse(data);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || "Invalid product data", 400);
    }

    const product = await createProduct(parsed.data);
    return successResponse(product, "Product created successfully");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create product");
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    if (data.action === "adjust_stock") {
      const parsed = stockAdjustSchema.safeParse(data);
      if (!parsed.success) {
        return errorResponse(
          parsed.error.errors[0]?.message || "Invalid stock adjustment data",
          400,
        );
      }

      const result = await adjustStock(parsed.data);
      return successResponse(result, "Stock adjusted");
    }

    const parsed = productUpdateSchema.safeParse(data);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || "Invalid product data", 400);
    }

    const { id, ...productData } = parsed.data;
    const product = await updateProduct(id, productData);
    return successResponse(product, "Product updated successfully");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update product");
  }
}

export async function DELETE(req: Request) {
  try {
    const data = await req.json();
    const parsed = deleteProductSchema.safeParse(data);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || "Invalid product data", 400);
    }

    const { id } = parsed.data;
    await deleteProduct(id);
    return successResponse(null, "Product deleted");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to delete product");
  }
}
