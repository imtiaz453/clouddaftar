"use client";

import { useEffect } from "react";
import { resetTenantThemeDom } from "@/lib/default-theme";

export function AuthThemeReset() {
  useEffect(() => {
    const root = document.documentElement;
    const previousAuthTheme = root.dataset.authFixedTheme;

    root.dataset.authFixedTheme = "true";
    resetTenantThemeDom(root);
    root.classList.remove("dark");

    return () => {
      if (previousAuthTheme) {
        root.dataset.authFixedTheme = previousAuthTheme;
      } else {
        delete root.dataset.authFixedTheme;
      }
    };
  }, []);

  return null;
}
