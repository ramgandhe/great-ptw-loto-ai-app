import type { ColorMode, ThemeColors, ThemeName, ThemePreferences, ThemeTokens } from "./types";

const baseLight = {
  background: "#ffffff",
  foreground: "#171717",
  muted: "#f5f5f5",
  mutedForeground: "#737373",
  border: "#e5e5e5",
  card: "#ffffff",
  primaryForeground: "#ffffff",
};

const baseDark = {
  background: "#0a0a0a",
  foreground: "#fafafa",
  muted: "#262626",
  mutedForeground: "#a3a3a3",
  border: "#404040",
  card: "#171717",
  primaryForeground: "#0a0a0a",
};

const primaryByTheme: Record<ThemeName, string> = {
  hazard: "#ea580c",
  "control-room": "#2563eb",
  setu: "#059669",
  "ledger-slate": "#475569",
};

function palette(theme: ThemeName, mode: ColorMode): ThemeColors {
  const base = mode === "dark" ? baseDark : baseLight;
  return { ...base, primary: primaryByTheme[theme] };
}

export function createThemeTokens(preferences: ThemePreferences): ThemeTokens {
  const compact = preferences.density === "compact";
  const strict = preferences.visualStyle === "strict";

  return {
    colors: palette(preferences.theme, preferences.mode),
    spacing: { md: compact ? 12 : 16, lg: compact ? 20 : 24 },
    radius: strict ? 4 : 8,
    typography: { body: compact ? 13 : 14, title: compact ? 18 : 20 },
  };
}

export const defaultPreferences: ThemePreferences = {
  theme: "hazard",
  density: "normal",
  visualStyle: "standard",
  mode: "light",
};
