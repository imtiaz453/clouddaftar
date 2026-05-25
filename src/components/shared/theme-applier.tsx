"use client";

import { useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { getThemeCssVars, FONT_MAP } from "@/lib/theme-mapping";

interface ThemeSettings {
  sidebarColor?: string;
  sidebarStyle?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  layoutDensity?: string;
  isDarkMode?: boolean;
}

interface CurrencySettings {
  currency?: string | null;
  currencySymbol?: string | null;
  currencyPosition?: string | null;
  country?: string | null;
  taxName?: string | null;
  taxComplianceMode?: string | null;
  thousandSeparator?: string | null;
  decimalSeparator?: string | null;
  decimalPlaces?: number | null;
}

interface ThemeApplierProps {
  theme: ThemeSettings | null;
  currency?: CurrencySettings | null;
  scopeKey?: string | null;
}

export const THEME_CACHE_KEY = "applied-theme";
const LEGACY_THEME_CACHE_KEY = THEME_CACHE_KEY;

function scopedThemeCacheKey(scopeKey?: string | null) {
  return scopeKey ? `${THEME_CACHE_KEY}:${scopeKey}` : null;
}

function clearGlassTheme(root: HTMLElement) {
  root.classList.remove("theme-glass");
  if (root.dataset.themePreset === "glass") {
    delete root.dataset.themePreset;
  }
}

function applyThemeToDOM(
  theme: ThemeSettings,
  setTheme: (t: string) => void,
  explicit: boolean = false,
  skipCache: boolean = false,
  cacheKey?: string | null,
) {
  const root = document.documentElement;
  const isGlassTheme = theme.sidebarStyle === "glass";
  clearGlassTheme(root);
  if (isGlassTheme) {
    root.classList.add("theme-glass");
    root.dataset.themePreset = "glass";
  }

  // Apply CSS variables
  const vars = getThemeCssVars(theme);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  // Inject font override
  const font = FONT_MAP[theme.fontFamily || "inter"] || FONT_MAP.inter;
  let styleEl = document.getElementById("theme-font-override") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "theme-font-override";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    body, [class*="__className"], [class*="__variable"] {
      font-family: ${font} !important;
    }
  `;

  // Apply dark mode
  if (theme.isDarkMode !== undefined) {
    if (explicit) {
      setTheme(theme.isDarkMode ? "dark" : "light");
      localStorage.setItem("theme-preference", theme.isDarkMode ? "dark" : "light");
    } else {
      const stored = localStorage.getItem("theme-preference");
      if (!stored) {
        setTheme(theme.isDarkMode ? "dark" : "light");
      }
    }
  }

  // Layout density
  if (theme.layoutDensity) {
    const densityMap: Record<string, string> = {
      compact: "0.85",
      comfortable: "1",
      spacious: "1.15",
    };
    root.style.setProperty("--spacing-scale", densityMap[theme.layoutDensity] || "1");
  }

  // Sidebar style
  root.style.setProperty("--sidebar-style", theme.sidebarStyle || "minimal");

  window.dispatchEvent(new CustomEvent("theme-updated", { detail: theme }));

  // Cache to localStorage (skip for live preview)
  if (!skipCache && cacheKey) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(theme));
      localStorage.removeItem(LEGACY_THEME_CACHE_KEY);
    } catch {}
  }
}

export function syncCachedThemeSettings(theme: ThemeSettings, scopeKey?: string | null) {
  const cacheKey = scopedThemeCacheKey(scopeKey);
  try {
    if (cacheKey) {
      localStorage.setItem(cacheKey, JSON.stringify(theme));
      localStorage.removeItem(LEGACY_THEME_CACHE_KEY);
    }
  } catch {}

  try {
    if (!scopeKey) return;
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith("cloud-daftar-settings:")) continue;
      if (!key.endsWith(`:${scopeKey}`)) continue;
      const cached = sessionStorage.getItem(key);
      if (!cached) continue;
      const parsed = JSON.parse(cached);
      sessionStorage.setItem(
        key,
        JSON.stringify({
          ...parsed,
          createdAt: Date.now(),
          theme,
        }),
      );
    }
  } catch {}
}

function applyCurrencyToDOM(currency: CurrencySettings | null | undefined) {
  if (!currency) return;
  const root = document.documentElement;
  root.dataset.currency = currency.currency || "PKR";
  root.dataset.currencySymbol = currency.currencySymbol || "Rs";
  root.dataset.taxLabel =
    currency.country === "SA" ||
    currency.currency === "SAR" ||
    currency.taxComplianceMode === "ZATCA"
      ? "VAT"
      : currency.taxName || "Tax";
  root.dataset.currencyPosition = currency.currencyPosition === "right" ? "right" : "left";
  root.dataset.thousandSeparator = currency.thousandSeparator || ",";
  root.dataset.decimalSeparator = currency.decimalSeparator || ".";
  root.dataset.decimalPlaces = String(currency.decimalPlaces ?? 2);
}

export function ThemeApplier({ theme, currency, scopeKey }: ThemeApplierProps) {
  const { setTheme } = useTheme();
  const cacheKey = scopedThemeCacheKey(scopeKey);

  const handleThemePreview = useCallback(
    (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        applyThemeToDOM(customEvent.detail, setTheme, true, true, cacheKey);
      }
    },
    [setTheme, cacheKey],
  );

  const handleThemeSaved = useCallback(
    (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        applyThemeToDOM(customEvent.detail, setTheme, true, false, cacheKey);
        syncCachedThemeSettings(customEvent.detail, scopeKey);
      }
    },
    [setTheme, cacheKey, scopeKey],
  );

  const handleCurrencySaved = useCallback((e: Event) => {
    const customEvent = e as CustomEvent;
    applyCurrencyToDOM(customEvent.detail);
  }, []);

  useEffect(() => {
    if (!cacheKey) return;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        applyThemeToDOM(parsed, setTheme, false, false, cacheKey);
      }
    } catch {}
  }, [setTheme, cacheKey]);

  useEffect(() => {
    if (theme) {
      applyThemeToDOM(theme, setTheme, false, false, cacheKey);
    }
    applyCurrencyToDOM(currency);
  }, [theme, currency, setTheme, cacheKey]);

  useEffect(() => {
    window.addEventListener("theme-preview", handleThemePreview);
    window.addEventListener("theme-saved", handleThemeSaved);
    window.addEventListener("currency-saved", handleCurrencySaved);
    return () => {
      window.removeEventListener("theme-preview", handleThemePreview);
      window.removeEventListener("theme-saved", handleThemeSaved);
      window.removeEventListener("currency-saved", handleCurrencySaved);
    };
  }, [handleThemePreview, handleThemeSaved, handleCurrencySaved]);

  return null;
}
