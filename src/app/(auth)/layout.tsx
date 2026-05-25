"use client";

import { usePathname } from "next/navigation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname?.endsWith("/login");

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-8 lg:flex-none lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
      <div className="relative hidden flex-1 lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-background" />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md space-y-8">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-primary">Cloud Daftar</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Modern business management</h2>
              <p className="mt-3 text-muted-foreground">
                Inventory, sales, purchases, accounting, and reporting — built for growing SMEs.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Inventory", value: "Real-time stock" },
                { label: "Sales", value: "POS & invoicing" },
                { label: "Reports", value: "Live analytics" },
                { label: "Multi-tenant", value: "Secure isolation" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border/80 bg-card/60 p-4 backdrop-blur-sm"
                >
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
