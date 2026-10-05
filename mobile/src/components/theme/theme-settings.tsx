import { View } from "react-native";
import { ChoiceGroup } from "@/components/ui";
import { useTheme } from "@/providers/theme-provider";
import type { ColorMode, Density, ThemeName, VisualStyle } from "@/theme/types";
import { WEB_THEMES } from "@/theme/web-themes";

const THEME_LABELS: Record<ThemeName, string> = { hazard: "Hazard", "control-room": "Control Room", setu: "Setu", "ledger-slate": "Ledger Slate" };
const options = <K extends string>(labels: Record<K, string>) => (Object.entries(labels) as [K, string][]).map(([key, label]) => ({ key, label }));

export function ThemeSettings() {
  const { preferences, setTheme, setDensity, setVisualStyle, setMode, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.space[5] }}>
      <ChoiceGroup
        label="Theme"
        options={options(THEME_LABELS).map((o) => ({ ...o, swatch: WEB_THEMES[o.key].light.accentPrimary }))}
        value={preferences.theme}
        onChange={setTheme}
      />
      <ChoiceGroup label="Mode" options={options<ColorMode>({ light: "Light", dark: "Dark" })} value={preferences.mode} onChange={setMode} />
      <ChoiceGroup label="Density" options={options<Density>({ normal: "Normal", compact: "Compact" })} value={preferences.density} onChange={setDensity} />
      <ChoiceGroup label="Visual style" options={options<VisualStyle>({ standard: "Standard", strict: "Strict" })} value={preferences.visualStyle} onChange={setVisualStyle} />
    </View>
  );
}
