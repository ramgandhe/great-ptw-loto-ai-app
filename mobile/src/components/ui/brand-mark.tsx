import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "@/providers/theme-provider";
import { AppText } from "./text";

/** The product mark, as on the web: a signed-off permit and a spark, then the name. */
export function BrandMark() {
  const { tokens } = useTheme();
  const { primary, primaryForeground } = tokens.colors;
  return (
    <View accessible accessibilityLabel="PermitWiseAI" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Rect x={1} y={1} width={22} height={22} rx={6} fill={primary} />
        <Path d="M7 5.5h6.5l3.5 3.5v9.5H7z" strokeWidth={1.6} strokeLinejoin="round" fill={primary} stroke={primaryForeground} />
        <Path d="m9.3 13.4 1.9 1.9 3.6-3.9" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" stroke={primaryForeground} />
        <Path d="M18.6 2.6l.55 1.25 1.25.55-1.25.55-.55 1.25-.55-1.25-1.25-.55 1.25-.55z" fill={primaryForeground} />
      </Svg>
      <AppText variant="title" style={{ fontSize: tokens.text.md + 1 }}>
        PermitWise<AppText variant="title" tone="accent" style={{ fontSize: tokens.text.md + 1 }}>AI</AppText>
      </AppText>
    </View>
  );
}
