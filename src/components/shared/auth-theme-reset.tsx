"use client";

import { useEffect } from "react";

export function AuthThemeReset() {
  useEffect(() => {
    const root = document.documentElement;
    const previousAuthTheme = root.dataset.authFixedTheme;

    root.dataset.authFixedTheme = "true";
    root.classList.remove("theme-glass", "dark");
    if (root.dataset.themePreset === "glass") {
      delete root.dataset.themePreset;
    }
    document.getElementById("theme-font-override")?.remove();

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
