import { getDashboardStats } from "@/actions/dashboard";
import { ReportsClient } from "./reports-client";

export async function ReportsPage() {
  try {
    const stats = await getDashboardStats();
    return <ReportsClient stats={stats} />;
  } catch {
    return <div className="flex h-[50vh] items-center justify-center"><p className="text-muted-foreground">Could not load</p></div>;
  }
}
