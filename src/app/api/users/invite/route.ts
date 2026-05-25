import { inviteUser } from "@/actions/users";
import { successResponse, errorResponse } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const invitation = await inviteUser(data);
    return successResponse(invitation, "Invitation sent");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to invite user");
  }
}
