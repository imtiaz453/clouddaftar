import { getDashboardStats } from "@/actions/dashboard";
import { DashboardClient } from "./dashboard-client";

export async function DashboardPage() {
  let stats;
  try {
    stats = await getDashboardStats();
  } catch {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Sign in to view your dashboard</p>
        </div>
      </div>
    );
  }

  return <DashboardClient stats={stats} />;
}
