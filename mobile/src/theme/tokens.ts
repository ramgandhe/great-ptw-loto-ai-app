import { themeFonts } from "./fonts";
import type { ThemePreferences, ThemeTokens } from "./types";
import { WEB_STATUS, WEB_THEMES } from "./web-themes";

// Web --space-* and --text-* (themes.css), with the compact density values.
const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
const SPACE_COMPACT = { 1: 2, 2: 4, 3: 8, 4: 12, 5: 14, 6: 16, 8: 24, 10: 28, 12: 36 } as const;
const TEXT = { xs: 12, sm: 13, base: 15, md: 17, lg: 20, xl: 26, xxl: 32, xxxl: 42 } as const;
const TEXT_COMPACT = { xs: 11, sm: 12, base: 14, md: 15, lg: 18, xl: 22, xxl: 28, xxxl: 36 } as const;

const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const luminance = (h: string) => {
  const [r, g, b] = channels(h).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** `fg` laid over `bg` at `alpha` (what a tinted chip or button background really looks like). */
export function blend(fg: string, alpha: number, bg: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(fg) || !/^#[0-9a-f]{6}$/i.test(bg)) return bg;
  const f = channels(fg);
  const b = channels(bg);
  return toHex(f.map((v, i) => v * alpha + b[i] * (1 - alpha)));
}

/**
 * The colour itself when it already reads on `bg` (WCAG: 4.5:1 for text, 3:1 for field edges),
 * otherwise the nearest shade that does: darker on light backgrounds, lighter on dark ones.
 * The web theme colours are kept for fills, dots and edges; text and field borders go through this.
 */
export function readable(color: string, bg: string, min = 4.5): string {
  if (!/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(bg)) return color;
  const target = luminance(bg) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  const start = channels(color);
  for (let step = 0; step <= 20; step++) {
    const candidate = toHex(start.map((v, i) => v + (target[i] - v) * (step / 20)));
    if (contrast(candidate, bg) >= min) return candidate;
  }
  return toHex(target);
}

// Hazard and Setu float cards on a medium shadow, Control room and Ledger Slate on a small one.
const DEEP_SHADOW = new Set(["hazard", "setu"]);

/** The app's theme, built from the same tokens as the web (see web-themes.ts). */
export function createThemeTokens(preferences: ThemePreferences): ThemeTokens {
  const compact = preferences.density === "compact";
  const strict = preferences.visualStyle === "strict";
  const dark = preferences.mode === "dark";
  const theme = WEB_THEMES[preferences.theme];
  const c = dark ? theme.dark : theme.light;
  const status = dark ? WEB_STATUS.dark : WEB_STATUS.light;
  const radii = strict ? { xs: 2, sm: 2, md: 4, lg: 4, xl: 6, full: 4 } : { ...theme.radius, full: 999 };
  const deep = DEEP_SHADOW.has(preferences.theme);
  const space = compact ? SPACE_COMPACT : SPACE;
  const text = compact ? TEXT_COMPACT : TEXT;

  // Text in a status colour sits on its pale banner and on cards: it must read on both.
  const onBoth = (color: string, tintBg: string) => readable(readable(color, tintBg), c.bgSurface);
  // Fields must not look like the card they sit on: sunken on light themes, lifted on dark ones.
  const inputFill = dark ? blend(c.textPrimary, 0.08, c.bgSurface) : c.bgSunken;

  return {
    dark,
    colors: {
      background: c.bgCanvas,
      foreground: c.textPrimary,
      primary: c.accentPrimary,
      primaryForeground: c.accentOnPrimary,
      // Solid buttons darken the brand colour just enough for their label to read (Hazard's #ff4530 does not).
      primaryFill: readable(c.accentPrimary, c.accentOnPrimary),
      primaryText: onBoth(c.accentPrimary, c.bgCanvas),
      muted: c.bgSunken,
      mutedForeground: c.textTertiary,
      border: c.borderDefault,
      inputBorder: readable(readable(c.borderStrong, c.bgSurface, 3), inputFill, 3),
      inputFill,
      card: c.bgSurface,
      cardRaised: c.bgSurfaceRaised,
      overlay: c.bgOverlay,
      borderSubtle: c.borderSubtle,
      borderStrong: c.borderStrong,
      textSecondary: c.textSecondary,
      textDisabled: readable(c.textDisabled, c.bgSurface, 3),
      secondary: c.accentSecondary,
      secondaryForeground: c.accentSecondaryOn,
      focus: c.focusRing,
      success: onBoth(c.statusSuccess, c.statusSuccessBg),
      successBg: c.statusSuccessBg,
      danger: onBoth(c.statusDanger, c.statusDangerBg),
      dangerBg: c.statusDangerBg,
      warning: onBoth(c.statusWarning, c.statusWarningBg),
      warningBg: c.statusWarningBg,
      info: onBoth(c.statusInfo, c.statusInfoBg),
      infoBg: c.statusInfoBg,
    },
    status: status.permit,
    statusInk: status.ink,
    action: status.action,
    fonts: themeFonts(preferences.theme, preferences.visualStyle),
    radii,
    radius: radii.md,
    borderWidth: theme.borderWidth,
    shadow: {
      shadowColor: dark ? "#000000" : "#141414",
      shadowOffset: { width: 0, height: deep ? 6 : 2 },
      shadowRadius: deep ? 9 : 4,
      shadowOpacity: dark ? 0.5 : deep ? 0.14 : 0.1,
      elevation: deep ? 4 : 2,
    },
    space,
    spacing: { md: space[4], lg: space[5] },
    text,
    typography: { body: text.base, title: text.xl },
    displayTracking: preferences.theme === "hazard" || preferences.theme === "control-room" ? -0.3 : 0,
  };
}

export const defaultPreferences: ThemePreferences = {
  theme: "hazard",
  density: "normal",
  visualStyle: "standard",
  mode: "light",
};

/** A colour at the given opacity, like the web's color-mix tints (#rrggbb only; others pass through). */
export function tint(color: string, alpha: number): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color + Math.round(alpha * 255).toString(16).padStart(2, "0") : color;
}
