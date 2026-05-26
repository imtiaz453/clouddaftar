export const DEFAULT_THEME_CSS_VARS: Record<string, string> = {
  "--background": "220 20% 97%",
  "--foreground": "224 47% 11%",
  "--card": "0 0% 100%",
  "--card-foreground": "224 40% 14%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "224 40% 14%",
  "--primary": "262 83% 58%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "220 18% 94%",
  "--secondary-foreground": "224 30% 22%",
  "--muted": "220 16% 93%",
  "--muted-foreground": "220 10% 42%",
  "--accent": "262 60% 96%",
  "--accent-foreground": "262 55% 32%",
  "--destructive": "0 72% 51%",
  "--destructive-foreground": "0 0% 100%",
  "--border": "220 16% 88%",
  "--input": "220 16% 88%",
  "--ring": "262 83% 58%",
  "--radius": "0.625rem",
  "--sidebar-background": "224 47% 11%",
  "--sidebar-foreground": "210 40% 98%",
  "--sidebar-primary": "262 83% 58%",
  "--sidebar-primary-foreground": "0 0% 100%",
  "--sidebar-accent": "224 35% 16%",
  "--sidebar-accent-foreground": "210 40% 98%",
  "--sidebar-border": "224 30% 20%",
  "--sidebar-ring": "262 83% 58%",
  "--spacing-scale": "1",
  "--sidebar-style": "gradient",
  "--font-family-body": "var(--font-sans), system-ui, -apple-system, sans-serif",
};

export function resetTenantThemeDom(root: HTMLElement) {
  root.classList.remove("theme-glass");
  if (root.dataset.themePreset === "glass") {
    delete root.dataset.themePreset;
  }

  Object.entries(DEFAULT_THEME_CSS_VARS).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  delete root.dataset.currency;
  delete root.dataset.currencySymbol;
  delete root.dataset.taxLabel;
  delete root.dataset.currencyPosition;
  delete root.dataset.thousandSeparator;
  delete root.dataset.decimalSeparator;
  delete root.dataset.decimalPlaces;
  document.getElementById("theme-font-override")?.remove();
}
