"use client";

import { createContext, useContext, useEffect, useState } from "react";

export const THEMES = ["hazard", "control-room", "setu", "ledger-slate"] as const;
export type ThemeName = (typeof THEMES)[number];

export const DENSITIES = ["normal", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export const STYLES = ["standard", "strict"] as const;
export type VisualStyle = (typeof STYLES)[number];

interface ThemeContextValue {
  theme: ThemeName;
  density: Density;
  visualStyle: VisualStyle;
  mode: "light" | "dark";
  setTheme: (theme: ThemeName) => void;
  setDensity: (density: Density) => void;
  setVisualStyle: (style: VisualStyle) => void;
  setMode: (mode: "light" | "dark") => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "ptw-theme-preferences";

function loadPreferences() {
  if (typeof window === "undefined") {
    return {
      theme: "hazard" as ThemeName,
      density: "normal" as Density,
      visualStyle: "standard" as VisualStyle,
      mode: "light" as const,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }

  return {
    theme: "hazard" as ThemeName,
    density: "normal" as Density,
    visualStyle: "standard" as VisualStyle,
    mode: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(loadPreferences);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", preferences.theme);
    root.setAttribute("data-density", preferences.density);
    root.setAttribute("data-style", preferences.visualStyle);
    root.classList.toggle("dark", preferences.mode === "dark");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const value: ThemeContextValue = {
    ...preferences,
    setTheme: (theme) => setPreferences((p: typeof preferences) => ({ ...p, theme })),
    setDensity: (density) => setPreferences((p: typeof preferences) => ({ ...p, density })),
    setVisualStyle: (visualStyle) =>
      setPreferences((p: typeof preferences) => ({ ...p, visualStyle })),
    setMode: (mode) => setPreferences((p: typeof preferences) => ({ ...p, mode })),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
