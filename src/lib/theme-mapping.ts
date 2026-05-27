// Maps ThemeSettings values to CSS custom property values

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const THEME_COLORS: Record<string, Record<string, any>> = {
  sidebar: {
    white: {
      background: "0 0% 100%",
      foreground: "222 47% 11%",
      accent: "210 40% 96%",
      "accent-foreground": "222 47% 11%",
    },
    light: {
      background: "210 40% 98%",
      foreground: "222 47% 11%",
      accent: "214 32% 91%",
      "accent-foreground": "222 47% 11%",
    },
    slate: {
      background: "215 28% 17%",
      foreground: "210 40% 98%",
      accent: "215 25% 27%",
      "accent-foreground": "210 40% 98%",
    },
    zinc: {
      background: "240 10% 10%",
      foreground: "0 0% 98%",
      accent: "240 5% 26%",
      "accent-foreground": "0 0% 98%",
    },
    neutral: {
      background: "0 0% 13%",
      foreground: "0 0% 95%",
      accent: "0 0% 23%",
      "accent-foreground": "0 0% 95%",
    },
    dark: {
      background: "0 0% 7%",
      foreground: "0 0% 93%",
      accent: "0 0% 18%",
      "accent-foreground": "0 0% 93%",
    },
    blue: {
      background: "217 33% 17%",
      foreground: "210 40% 98%",
      accent: "217 33% 25%",
      "accent-foreground": "210 40% 98%",
    },
    indigo: {
      background: "238 30% 16%",
      foreground: "210 40% 98%",
      accent: "238 30% 25%",
      "accent-foreground": "210 40% 98%",
    },
    violet: {
      background: "262 35% 16%",
      foreground: "210 40% 98%",
      accent: "262 35% 25%",
      "accent-foreground": "210 40% 98%",
    },
    green: {
      background: "142 30% 14%",
      foreground: "210 40% 96%",
      accent: "142 30% 22%",
      "accent-foreground": "210 40% 96%",
    },
    emerald: {
      background: "160 35% 14%",
      foreground: "210 40% 96%",
      accent: "160 35% 22%",
      "accent-foreground": "210 40% 96%",
    },
    teal: {
      background: "173 35% 15%",
      foreground: "210 40% 96%",
      accent: "173 35% 23%",
      "accent-foreground": "210 40% 96%",
    },
    cyan: {
      background: "190 35% 16%",
      foreground: "210 40% 96%",
      accent: "190 35% 24%",
      "accent-foreground": "210 40% 96%",
    },
    red: {
      background: "0 30% 18%",
      foreground: "210 40% 98%",
      accent: "0 30% 26%",
      "accent-foreground": "210 40% 98%",
    },
    orange: {
      background: "24 35% 16%",
      foreground: "210 40% 98%",
      accent: "24 35% 24%",
      "accent-foreground": "210 40% 98%",
    },
    amber: {
      background: "38 35% 15%",
      foreground: "210 40% 98%",
      accent: "38 35% 23%",
      "accent-foreground": "210 40% 98%",
    },
    rose: {
      background: "350 30% 17%",
      foreground: "210 40% 98%",
      accent: "350 30% 25%",
      "accent-foreground": "210 40% 98%",
    },
    plum: {
      background: "311 25% 16%",
      foreground: "210 40% 98%",
      accent: "311 25% 24%",
      "accent-foreground": "210 40% 98%",
    },
    brand: {
      background: "312 23% 37%",
      foreground: "210 40% 98%",
      accent: "312 20% 30%",
      "accent-foreground": "210 40% 98%",
    },
  },
  primary: {
    blue: { DEFAULT: "312 23% 37%", foreground: "210 40% 98%" },
    green: { DEFAULT: "142.1 76.2% 36.3%", foreground: "355 100% 97%" },
    violet: { DEFAULT: "262.1 83.3% 57.8%", foreground: "210 40% 98%" },
    red: { DEFAULT: "0 72.2% 50.6%", foreground: "210 40% 98%" },
    orange: { DEFAULT: "24.6 95% 53.1%", foreground: "210 40% 98%" },
    slate: { DEFAULT: "215 28% 17%", foreground: "210 40% 98%" },
    plum: { DEFAULT: "312 23% 37%", foreground: "210 40% 98%" },
    indigo: { DEFAULT: "238.7 83.5% 66.7%", foreground: "210 40% 98%" },
    emerald: { DEFAULT: "160.1 84.1% 39.4%", foreground: "210 40% 98%" },
    teal: { DEFAULT: "172.5 66% 50.4%", foreground: "210 40% 98%" },
    cyan: { DEFAULT: "189.2 93.6% 52.6%", foreground: "210 40% 98%" },
    amber: { DEFAULT: "37.7 92.1% 50.2%", foreground: "210 40% 98%" },
    rose: { DEFAULT: "346.8 77.2% 49.8%", foreground: "210 40% 98%" },
  },
  accent: {
    blue: { DEFAULT: "183 43% 92%", foreground: "184 54% 20%" },
    green: { DEFAULT: "142.1 76.2% 36.3%", foreground: "355 100% 97%" },
    violet: { DEFAULT: "262.1 83.3% 57.8%", foreground: "210 40% 98%" },
    amber: { DEFAULT: "38 92% 50%", foreground: "210 40% 98%" },
    rose: { DEFAULT: "346.8 77.2% 49.8%", foreground: "210 40% 98%" },
    indigo: { DEFAULT: "238.7 83.5% 66.7%", foreground: "210 40% 98%" },
    emerald: { DEFAULT: "160.1 84.1% 39.4%", foreground: "210 40% 98%" },
    teal: { DEFAULT: "172.5 66% 50.4%", foreground: "210 40% 98%" },
    cyan: { DEFAULT: "189.2 93.6% 52.6%", foreground: "210 40% 98%" },
    orange: { DEFAULT: "24.6 95% 53.1%", foreground: "210 40% 98%" },
    red: { DEFAULT: "0 72.2% 50.6%", foreground: "210 40% 98%" },
    plum: { DEFAULT: "311 46.3% 30%", foreground: "210 40% 98%" },
  },
};

export const RADIUS_MAP: Record<string, string> = {
  none: "0px",
  small: "0.25rem",
  normal: "0.5rem",
  large: "0.75rem",
};

export const FONT_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

const BASE_LIGHT_VARS: Record<string, string> = {
  "--background": "220 20% 97%",
  "--foreground": "224 47% 11%",
  "--card": "0 0% 100%",
  "--card-foreground": "224 40% 14%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "224 40% 14%",
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
};

const BASE_DARK_VARS: Record<string, string> = {
  "--background": "224 47% 7%",
  "--foreground": "210 40% 98%",
  "--card": "224 40% 10%",
  "--card-foreground": "210 40% 98%",
  "--popover": "224 40% 10%",
  "--popover-foreground": "210 40% 98%",
  "--secondary": "224 32% 16%",
  "--secondary-foreground": "210 40% 98%",
  "--muted": "224 32% 16%",
  "--muted-foreground": "215 16% 62%",
  "--accent": "262 40% 18%",
  "--accent-foreground": "262 70% 85%",
  "--destructive": "0 62% 45%",
  "--destructive-foreground": "210 40% 98%",
  "--border": "224 28% 18%",
  "--input": "224 28% 18%",
  "--ring": "262 80% 65%",
};

export function getThemeCssVars(theme: {
  sidebarColor?: string;
  sidebarStyle?: string;
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  layoutDensity?: string;
  isDarkMode?: boolean;
}) {
  const vars: Record<string, string> = {
    ...(theme.isDarkMode ? BASE_DARK_VARS : BASE_LIGHT_VARS),
  };

  if (theme.sidebarStyle === "glass") {
    return {
      "--background": "210 7% 84%",
      "--foreground": "220 14% 8%",
      "--card": "0 0% 100%",
      "--card-foreground": "220 14% 8%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "220 14% 8%",
      "--primary": "220 14% 8%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "210 7% 88%",
      "--secondary-foreground": "220 14% 8%",
      "--muted": "210 7% 88%",
      "--muted-foreground": "215 10% 35%",
      "--accent": "0 0% 100%",
      "--accent-foreground": "220 14% 8%",
      "--border": "0 0% 100%",
      "--input": "0 0% 100%",
      "--ring": "0 0% 100%",
      "--sidebar-background": "210 7% 86%",
      "--sidebar-foreground": "220 14% 8%",
      "--sidebar-primary": "220 14% 8%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "0 0% 100%",
      "--sidebar-accent-foreground": "220 14% 8%",
      "--sidebar-border": "0 0% 100%",
      "--sidebar-ring": "0 0% 100%",
      "--neutral-tertiary": "0 0% 100%",
      "--radius": "1rem",
      "--font-family-body": FONT_MAP[theme.fontFamily || "inter"] || FONT_MAP.inter,
    };
  }

  const sidebar = THEME_COLORS.sidebar[theme.sidebarColor || "brand"];
  const primary = THEME_COLORS.primary[theme.primaryColor || "plum"];

  if (sidebar) {
    vars["--sidebar-background"] = sidebar.background;
    vars["--sidebar-foreground"] = sidebar.foreground;
    vars["--sidebar-accent"] = sidebar.accent;
    vars["--sidebar-accent-foreground"] = sidebar["accent-foreground"];
    vars["--sidebar-border"] = sidebar.accent;
    vars["--sidebar-ring"] = sidebar.accent;
    vars["--neutral-tertiary"] = sidebar.accent;
  }

  if (primary) {
    vars["--primary"] = primary.DEFAULT;
    vars["--primary-foreground"] = primary.foreground;
  }

  if (theme.accentColor) {
    const accent = THEME_COLORS.accent[theme.accentColor];
    if (accent) {
      vars["--accent"] = accent.DEFAULT;
      vars["--accent-foreground"] = accent.foreground;
    }
  }

  const radius = RADIUS_MAP[theme.borderRadius || "normal"];
  if (radius) vars["--radius"] = radius;

  const font = FONT_MAP[theme.fontFamily || "inter"];
  if (font) vars["--font-family-body"] = font;

  return vars;
}
