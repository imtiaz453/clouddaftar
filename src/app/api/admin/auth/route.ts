import { NextRequest } from "next/server";
import { adminLogin, checkAdminAuth, adminLogout } from "@/actions/admin";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { successResponse, errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { action, email, password } = await req.json();
    if (action === "login") {
      const result = await adminLogin(email, password);
      return successResponse(result);
    }
    if (action === "logout") {
      await adminLogout();
      return successResponse(null);
    }
    if (action === "check") {
      const isAuth = await checkAdminAuth();
      return successResponse({ authenticated: isAuth });
    }
    return errorResponse("Invalid action");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed");
  }
}

export async function GET() {
  try {
    const session = await getCurrentAdmin();
    return successResponse({ authenticated: session !== null, admin: session?.admin ?? null });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed");
  }
}
