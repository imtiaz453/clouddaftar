import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function DashboardLoading() {
  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
      <LoadingSpinner size={8} />
    </div>
  );
}
