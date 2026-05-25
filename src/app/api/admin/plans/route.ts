import { NextRequest } from "next/server";
import { getAllPlans, createPlan, updatePlan } from "@/actions/subscriptions";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const plans = await getAllPlans();
    return successResponse(plans);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch plans");
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const plan = await createPlan(data);
    return successResponse(plan, "Plan created");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create plan");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const { id, ...fields } = data;
    const plan = await updatePlan(id, fields);
    return successResponse(plan, "Plan updated");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update plan");
  }
}
