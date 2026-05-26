"use client";

import { usePathname } from "next/navigation";
import { AuthThemeReset } from "@/components/shared/auth-theme-reset";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname?.endsWith("/login");

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef3f8] px-4 py-10 text-slate-950 sm:px-6">
      <AuthThemeReset />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(37,99,235,0.14),rgba(255,255,255,0)_42%),linear-gradient(180deg,rgba(255,255,255,0.88),rgba(226,232,240,0.92))]" />
      <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute left-0 top-0 h-24 w-full border-b border-white/70 bg-white/45" />

      <div className="relative z-10 w-full max-w-[520px]">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-600/25">
            CD
          </div>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
            Cloud Daftar
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
