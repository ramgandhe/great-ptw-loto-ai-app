"use client";

import {
  DENSITIES,
  STYLES,
  THEMES,
  type Density,
  type ThemeName,
  type VisualStyle,
  useTheme,
} from "@/components/theme-provider";

const selectClassName =
  "h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground";

export function ThemeSettings() {
  const { theme, density, visualStyle, mode, setTheme, setDensity, setVisualStyle, setMode } =
    useTheme();

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <select
        aria-label="Theme"
        className={selectClassName}
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeName)}
      >
        {THEMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Density"
        className={selectClassName}
        value={density}
        onChange={(e) => setDensity(e.target.value as Density)}
      >
        {DENSITIES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Visual style"
        className={selectClassName}
        value={visualStyle}
        onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
      >
        {STYLES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Color mode"
        className={selectClassName}
        value={mode}
        onChange={(e) => setMode(e.target.value as "light" | "dark")}
      >
        <option value="light">light</option>
        <option value="dark">dark</option>
      </select>
    </div>
  );
}
