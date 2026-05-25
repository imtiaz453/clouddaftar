import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "@/components/layout/admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  const pendingCount = await prisma.paymentSubmission.count({
    where: { verifiedById: null },
  });

  const branding = await prisma.systemSetting.findMany({
    where: { key: { in: ["logoUrl", "appName"] } },
  });
  const brandingMap = Object.fromEntries(branding.map((r) => [r.key, r.value]));
  const logoUrl = brandingMap.logoUrl || "";
  const appName = brandingMap.appName || "Cloud Daftar";

  const navItems = [
    { href: "/cloud-daftar-admin/dashboard", label: "Dashboard" },
    { href: "/cloud-daftar-admin/plans", label: "Plans" },
    { href: "/cloud-daftar-admin/payments", label: "Payments" },
    { href: "/cloud-daftar-admin/tenants", label: "Tenants" },
    { href: "/cloud-daftar-admin/admins", label: "Admins" },
    { href: "/cloud-daftar-admin/audit", label: "Audit Log" },
    { href: "/cloud-daftar-admin/settings", label: "Branding" },
  ];

  return (
    <div className="app-workspace flex h-screen bg-background">
      <AdminSidebar
        navItems={navItems}
        logoUrl={logoUrl}
        appName={appName}
        admin={session.admin}
        pendingCount={pendingCount}
      />
      <main className="flex-1 overflow-auto pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
