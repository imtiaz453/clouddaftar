import { requireCompanyAuth } from "@/lib/auth-helper";
import { generateInvoice, getCompanyInvoices } from "@/actions/subscriptions";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const invoices = await getCompanyInvoices();
    return successResponse(invoices);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch invoices");
  }
}

export async function POST() {
  try {
    const user = await requireCompanyAuth();
    const invoice = await generateInvoice(user.companyId);
    return successResponse(invoice, "Invoice generated");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to generate invoice");
  }
}
