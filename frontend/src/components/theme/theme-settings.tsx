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
import { cn } from "@/lib/utils";

const selectClassName =
  "h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground";

type ThemeSettingsProps = {
  variant?: "toolbar" | "form";
  className?: string;
};

export function ThemeSettings({ variant = "toolbar", className }: ThemeSettingsProps) {
  const { theme, density, visualStyle, mode, setTheme, setDensity, setVisualStyle, setMode } =
    useTheme();

  if (variant === "form") {
    return (
      <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Theme</span>
          <select
            className={cn(selectClassName, "h-10 w-full text-sm")}
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeName)}
          >
            {THEMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Density</span>
          <select
            className={cn(selectClassName, "h-10 w-full text-sm")}
            value={density}
            onChange={(e) => setDensity(e.target.value as Density)}
          >
            {DENSITIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Visual style</span>
          <select
            className={cn(selectClassName, "h-10 w-full text-sm")}
            value={visualStyle}
            onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
          >
            {STYLES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Color mode</span>
          <select
            className={cn(selectClassName, "h-10 w-full text-sm")}
            value={mode}
            onChange={(e) => setMode(e.target.value as "light" | "dark")}
          >
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className={cn("ml-auto flex flex-wrap items-center gap-2", className)}>
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
