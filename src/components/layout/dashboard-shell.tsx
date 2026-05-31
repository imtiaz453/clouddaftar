import { AppShell } from "@/components/layout/app-shell";

interface DashboardShellProps {
  children: React.ReactNode;
  companyName?: string;
  companyLogo?: string | null;
  themeSettings?: Record<string, string> | null;
  rolePermissions?: Record<string, string[]> | null;
  userPermissionOverrides?: Record<string, unknown> | null;
  planCode?: string | null;
  userRole?: string;
  userName?: string;
  userEmail?: string;
  userImage?: string;
  permissions?: string[];
}

export function DashboardShell(props: DashboardShellProps) {
  return <AppShell {...props} />;
}
