import { NextRequest } from "next/server";
import { submitPayment } from "@/actions/billing";
import { successResponse, errorResponse } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const payment = await submitPayment(data.invoiceId, data);
    return successResponse(payment, "Payment submitted");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to submit payment");
  }
}
