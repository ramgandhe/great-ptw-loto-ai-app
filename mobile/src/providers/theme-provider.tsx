import { ActivityIndicator, View } from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadAsync } from "expo-font";
import { fontFiles } from "@/theme/fonts";
import { createThemeTokens, defaultPreferences } from "@/theme/tokens";
import type {
  ColorMode,
  Density,
  ThemeName,
  ThemePreferences,
  ThemeTokens,
  VisualStyle,
} from "@/theme/types";

const STORAGE_KEY = "ptw-mobile-theme";

interface ThemeContextValue {
  tokens: ThemeTokens;
  preferences: ThemePreferences;
  setTheme: (theme: ThemeName) => void;
  setDensity: (density: Density) => void;
  setVisualStyle: (visualStyle: VisualStyle) => void;
  setMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ThemePreferences>(defaultPreferences);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) {
          setPreferences({ ...defaultPreferences, ...JSON.parse(value) });
        }
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences, ready]);

  // A theme takes effect once its fonts are loaded, so text never shows in a missing font.
  const [applied, setApplied] = useState<ThemePreferences | null>(null);
  useEffect(() => {
    if (!ready) return;
    let current = true;
    loadAsync(fontFiles(createThemeTokens(preferences).fonts))
      .catch(() => undefined)
      .finally(() => current && setApplied(preferences));
    return () => {
      current = false;
    };
  }, [preferences, ready]);
  const tokens = useMemo(() => createThemeTokens(applied ?? preferences), [applied, preferences]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      tokens,
      preferences,
      setTheme: (theme) => setPreferences((p) => ({ ...p, theme })),
      setDensity: (density) => setPreferences((p) => ({ ...p, density })),
      setVisualStyle: (visualStyle) => setPreferences((p) => ({ ...p, visualStyle })),
      setMode: (mode) => setPreferences((p) => ({ ...p, mode })),
    }),
    [tokens, preferences],
  );

  if (!applied) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
