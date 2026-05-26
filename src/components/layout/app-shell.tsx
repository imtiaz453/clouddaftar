"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { RouteLoadingOverlay } from "@/components/layout/route-loading-overlay";

const AiInsightsWidget = dynamic(
  () => import("@/components/ai/ai-insights-widget").then((mod) => mod.AiInsightsWidget),
  { ssr: false },
);

interface AppShellProps {
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
}

export function AppShell({
  children,
  companyName,
  companyLogo,
  themeSettings,
  rolePermissions,
  userPermissionOverrides,
  planCode,
  userRole,
  userName,
  userEmail,
  userImage,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-responsive-root app-workspace min-h-screen">
      <Sidebar
        companyName={companyName}
        companyLogo={companyLogo}
        themeSettings={themeSettings}
        rolePermissions={rolePermissions}
        userPermissionOverrides={userPermissionOverrides}
        planCode={planCode}
        userRole={userRole}
        mobileOpen={mobileOpen}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "flex min-h-screen min-w-0 max-w-full flex-col overflow-x-hidden transition-[margin-left] duration-300 ease-out",
          collapsed ? "lg:ml-[4.25rem]" : "lg:ml-64",
        )}
      >
        <AppTopbar
          companyName={companyName}
          rolePermissions={rolePermissions}
          userPermissionOverrides={userPermissionOverrides}
          planCode={planCode}
          userRole={userRole}
          userName={userName}
          userEmail={userEmail}
          userImage={userImage}
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="content-area mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>

      <AiInsightsWidget />
      <RouteLoadingOverlay />
    </div>
  );
}
