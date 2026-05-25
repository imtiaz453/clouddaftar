import { getSuppliers, createSupplier } from "@/actions/purchases";
import { successResponse, errorResponse } from "@/lib/api";
import { supplierCreateSchema } from "@/lib/validations";

export async function GET() {
  try {
    const suppliers = await getSuppliers();
    return successResponse(suppliers);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch suppliers");
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const parsed = supplierCreateSchema.safeParse(data);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || "Invalid supplier data", 400);
    }

    const supplier = await createSupplier(parsed.data);
    return successResponse(supplier, "Supplier created");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create supplier");
  }
}
