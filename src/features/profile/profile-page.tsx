import { getProfile } from "@/actions/profile";
import { ProfileClient } from "./profile-client";

export async function ProfilePage() {
  try {
    const profile = await getProfile();
    return <ProfileClient profile={profile} />;
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Could not load</p>
      </div>
    );
  }
}
