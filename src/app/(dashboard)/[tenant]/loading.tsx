import { LinesLoader } from "@/components/ui/lines-loader";

export default function TenantDashboardLoading() {
  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <LinesLoader label="Loading route..." />
    </div>
  );
}
