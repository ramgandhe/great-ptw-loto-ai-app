export const THEMES = ["hazard", "control-room", "setu", "ledger-slate"] as const;
export type ThemeName = (typeof THEMES)[number];

export const DENSITIES = ["normal", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export const STYLES = ["standard", "strict"] as const;
export type VisualStyle = (typeof STYLES)[number];

export type ColorMode = "light" | "dark";

export interface ThemePreferences {
  theme: ThemeName;
  density: Density;
  visualStyle: VisualStyle;
  mode: ColorMode;
}

export interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  card: string;
}

export interface ThemeTokens {
  colors: ThemeColors;
  spacing: { md: number; lg: number };
  radius: number;
  typography: { body: number; title: number };
}
