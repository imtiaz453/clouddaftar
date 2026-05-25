import { getCustomers, createCustomer, updateCustomer } from "@/actions/sales";
import { successResponse, errorResponse } from "@/lib/api";
import { customerCreateSchema, customerUpdateSchema } from "@/lib/validations";

export async function GET() {
  try {
    const customers = await getCustomers();
    return successResponse(customers);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch customers");
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const parsed = customerCreateSchema.safeParse(data);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || "Invalid customer data", 400);
    }

    const customer = await createCustomer(parsed.data);
    return successResponse(customer, "Customer created");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create customer");
  }
}

export async function PATCH(req: Request) {
  try {
    const data = await req.json();
    const { id, ...fields } = data;
    if (!id) return errorResponse("Customer ID is required", 400);

    const parsed = customerUpdateSchema.safeParse(fields);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message || "Invalid customer data", 400);
    }

    const customer = await updateCustomer(id, parsed.data);
    return successResponse(customer, "Customer updated");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update customer");
  }
}
