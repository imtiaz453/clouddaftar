import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { updateUserPermissions } from "@/actions/users";
import { checkPermission } from "@/lib/auth-helper";
import { PERMISSIONS } from "@/lib/constants";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkPermission(PERMISSIONS.ROLES_MANAGE))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { membershipId, permissionOverrides } = await req.json();
    if (!membershipId) {
      return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
    }

    await updateUserPermissions(membershipId, permissionOverrides);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update permissions" },
      { status: 400 },
    );
  }
}
