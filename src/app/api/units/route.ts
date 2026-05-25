import { NextRequest } from "next/server";
import { getUnits, createUnit, updateUnit, deleteUnit } from "@/actions/units";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET() {
  try {
    const units = await getUnits();
    return successResponse(units);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch units");
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const unit = await createUnit(data);
    return successResponse(unit, "Unit created");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create unit");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const { id, ...fields } = data;
    if (!id) throw new Error("Unit ID is required");
    const unit = await updateUnit(id, fields);
    return successResponse(unit, "Unit updated");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update unit");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) throw new Error("Unit ID is required");
    await deleteUnit(id);
    return successResponse(null, "Unit deleted");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to delete unit");
  }
}
