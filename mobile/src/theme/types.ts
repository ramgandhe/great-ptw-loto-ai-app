import type { TextStyle, ViewStyle } from "react-native";

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

/** The web design system's colours (frontend/src/styles/themes.css), named as on the web. */
export interface ThemeColors {
  /** Page background (web --bg-canvas). */
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  /** Background of solid primary buttons: the brand colour, darkened only if its label would not read. */
  primaryFill: string;
  /** The brand colour as text (links, back links, counts), adjusted to read on canvas and cards. */
  primaryText: string;
  /** Sunken fill for chips, secondary buttons and inputs (web --bg-sunken). */
  muted: string;
  mutedForeground: string;
  border: string;
  /** Edges of fields and pickers: at least 3:1 against the surface and the field, so a field can be seen. */
  inputBorder: string;
  /** Inside of fields, pickers and choice pills: set apart from the card they sit on. */
  inputFill: string;
  /** Cards and sheets (web --bg-surface). */
  card: string;
  cardRaised: string;
  overlay: string;
  borderSubtle: string;
  borderStrong: string;
  textSecondary: string;
  textDisabled: string;
  secondary: string;
  secondaryForeground: string;
  focus: string;
  /** Status colours: answers Yes / No, signed, things left to do. */
  success: string;
  successBg: string;
  danger: string;
  dangerBg: string;
  warning: string;
  warningBg: string;
  info: string;
  infoBg: string;
}

export interface ThemeFonts {
  display: string;
  displayHeavy: string;
  body: string;
  bodyMedium: string;
  bodySemibold: string;
  bodyBold: string;
  mono: string;
  monoBold: string;
}

export interface ThemeTokens {
  dark: boolean;
  colors: ThemeColors;
  /** Permit status colours (web --st-*), keyed by status, and the text drawn on them. */
  status: Record<string, string>;
  statusInk: string;
  /** "Needs you" action colours (web --act-*): decide, fix, do, admin. */
  action: Record<"decide" | "fix" | "do" | "admin", string>;
  fonts: ThemeFonts;
  /** Corner radii of the theme (strict style squares them); `full` makes pills. */
  radii: { xs: number; sm: number; md: number; lg: number; xl: number; full: number };
  /** Default corner radius for controls (kept for screens written before the radii scale). */
  radius: number;
  borderWidth: number;
  /** Card elevation of the theme. */
  shadow: ViewStyle;
  /** Spacing scale (web --space-*), tighter in compact density. */
  space: Record<1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12, number>;
  spacing: { md: number; lg: number };
  /** Type scale (web --text-*). */
  text: Record<"xs" | "sm" | "base" | "md" | "lg" | "xl" | "xxl" | "xxxl", number>;
  typography: { body: number; title: number };
  displayTracking: TextStyle["letterSpacing"];
}
