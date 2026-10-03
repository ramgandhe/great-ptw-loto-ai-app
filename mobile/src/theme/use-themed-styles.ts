import { useMemo } from "react";
import { useTheme } from "@/providers/theme-provider";
import type { ThemeColors } from "./types";

/** Styles built from the active theme's colours, rebuilt when the theme or mode changes. */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { tokens } = useTheme();
  return useMemo(() => factory(tokens.colors), [tokens.colors, factory]);
}
