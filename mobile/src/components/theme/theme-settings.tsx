import { Pressable, StyleSheet, Text, View } from "react-native";
import { DENSITIES, STYLES, THEMES, type ColorMode } from "@/theme/types";
import { useTheme } from "@/providers/theme-provider";

function cycle<T extends string>(values: readonly T[], current: T): T {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

export function ThemeSettings() {
  const { preferences, setTheme, setDensity, setVisualStyle, setMode, tokens } = useTheme();
  const modes: ColorMode[] = ["light", "dark"];

  const row = (label: string, value: string, onPress: () => void) => (
    <Pressable
      style={[styles.row, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.card }]}
      onPress={onPress}
    >
      <Text style={{ color: tokens.colors.foreground }}>{label}</Text>
      <Text style={{ color: tokens.colors.mutedForeground }}>{value}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {row("Theme", preferences.theme, () => setTheme(cycle(THEMES, preferences.theme)))}
      {row("Density", preferences.density, () => setDensity(cycle(DENSITIES, preferences.density)))}
      {row("Style", preferences.visualStyle, () =>
        setVisualStyle(cycle(STYLES, preferences.visualStyle)),
      )}
      {row("Mode", preferences.mode, () => setMode(cycle(modes, preferences.mode)))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
});
