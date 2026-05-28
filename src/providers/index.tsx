"use client";

import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { IdleLogoutProvider } from "@/providers/idle-logout-provider";
import { ThemeApplier } from "@/components/shared/theme-applier";
import { ServiceWorkerRegistration } from "@/components/shared/service-worker-registration";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { resetTenantThemeDom } from "@/lib/default-theme";

const SETTINGS_CACHE_MS = 5 * 60 * 1000;
const SETTINGS_FETCH_DELAY_MS = 3000;

function ThemeSettingsFetcher({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname() ?? "";
  const [theme, setTheme] = useState<Record<string, string> | null>(null);
  const [currency, setCurrency] = useState<Record<string, string | number> | null>(null);
  const companyId = (session?.user as { companyId?: string } | undefined)?.companyId || null;
  const themeIsolatedRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/cloud-daftar-admin");

  useEffect(() => {
    if (!session || !companyId || themeIsolatedRoute) {
      setTheme(null);
      setCurrency(null);
      resetTenantThemeDom(document.documentElement);
      if (themeIsolatedRoute) document.documentElement.classList.remove("dark");
      return;
    }
    const cacheKey = `cloud-daftar-settings:${companyId}`;

    function handleThemeSaved(event: Event) {
      const nextTheme = (event as CustomEvent).detail || null;
      setTheme(nextTheme);
      try {
        const cached = window.sessionStorage.getItem(cacheKey);
        const parsed = cached ? JSON.parse(cached) : {};
        window.sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ ...parsed, createdAt: Date.now(), theme: nextTheme }),
        );
      } catch {}
    }

    window.addEventListener("theme-saved", handleThemeSaved);

    let shouldFetchSettings = true;

    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setTheme(parsed.theme || null);
        setCurrency(parsed.currency || null);
        if (Date.now() - Number(parsed.createdAt || 0) < SETTINGS_CACHE_MS) {
          shouldFetchSettings = false;
        }
      }
    } catch {}

    let idleId: number | null = null;
    const controller = shouldFetchSettings ? new AbortController() : null;
    const loadSettings = () => {
      if (!controller) return;
      fetch("/api/settings", { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          if (!data.success || !data.data) return;
          const company = data.data;
          const nextTheme = company.theme || null;
          const nextCurrency = {
            country: company.country || "PK",
            currency: company.currency || "PKR",
            currencySymbol: company.currencySymbol || "Rs",
            taxName: company.taxName || "Tax",
            taxComplianceMode: company.settings?.taxComplianceMode || "NONE",
            currencyPosition: company.settings?.currencyPosition || "left",
            thousandSeparator: company.settings?.thousandSeparator || ",",
            decimalSeparator: company.settings?.decimalSeparator || ".",
            decimalPlaces: company.settings?.decimalPlaces ?? 2,
          };
          setTheme(nextTheme);
          setCurrency(nextCurrency);
          try {
            window.sessionStorage.setItem(
              cacheKey,
              JSON.stringify({ createdAt: Date.now(), theme: nextTheme, currency: nextCurrency }),
            );
          } catch {}
        })
        .catch(() => {});
    };

    const timer = shouldFetchSettings
      ? window.setTimeout(() => {
          if ("requestIdleCallback" in window) {
            idleId = window.requestIdleCallback(loadSettings, { timeout: 2000 });
          } else {
            loadSettings();
          }
        }, SETTINGS_FETCH_DELAY_MS)
      : null;

    return () => {
      window.removeEventListener("theme-saved", handleThemeSaved);
      if (timer !== null) window.clearTimeout(timer);
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      controller?.abort();
    };
  }, [session, companyId, themeIsolatedRoute]);

  return (
    <>
      <ThemeApplier
        theme={companyId && !themeIsolatedRoute ? (theme as any) : null}
        currency={companyId && !themeIsolatedRoute ? (currency as any) : null}
        scopeKey={themeIsolatedRoute ? null : companyId}
      />
      {children}
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ServiceWorkerRegistration />
          <IdleLogoutProvider />
          <ThemeSettingsFetcher>{children}</ThemeSettingsFetcher>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
