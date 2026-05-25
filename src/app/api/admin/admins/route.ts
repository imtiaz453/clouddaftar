import { NextRequest } from "next/server";
import { listAdmins, createAdmin, updateAdmin } from "@/actions/admin";
import { successResponse, errorResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const page = Number(req.nextUrl.searchParams.get("page")) || 1;
    const data = await listAdmins(page);
    return successResponse(data);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch admins");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createAdmin(body);
    return successResponse(result, "Admin created");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create admin");
  }
}

export async function PUT(req: Request) {
  try {
    const { id, ...data } = await req.json();
    const result = await updateAdmin(id, data);
    return successResponse(result, "Admin updated");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update admin");
  }
}
