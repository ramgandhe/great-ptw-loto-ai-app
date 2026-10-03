import { Baloo2_700Bold } from "@expo-google-fonts/baloo-2/700Bold";
import { Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2/800ExtraBold";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono/600SemiBold";
import { IBMPlexSans_400Regular } from "@expo-google-fonts/ibm-plex-sans/400Regular";
import { IBMPlexSans_500Medium } from "@expo-google-fonts/ibm-plex-sans/500Medium";
import { IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans/600SemiBold";
import { IBMPlexSans_700Bold } from "@expo-google-fonts/ibm-plex-sans/700Bold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { NotoSans_400Regular } from "@expo-google-fonts/noto-sans/400Regular";
import { NotoSans_500Medium } from "@expo-google-fonts/noto-sans/500Medium";
import { NotoSans_600SemiBold } from "@expo-google-fonts/noto-sans/600SemiBold";
import { NotoSans_700Bold } from "@expo-google-fonts/noto-sans/700Bold";
import { Sora_700Bold } from "@expo-google-fonts/sora/700Bold";
import { Sora_800ExtraBold } from "@expo-google-fonts/sora/800ExtraBold";
import { SourceSerif4_700Bold } from "@expo-google-fonts/source-serif-4/700Bold";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import type { ThemeFonts, ThemeName, VisualStyle } from "./types";

/**
 * The web's fonts per theme (frontend/src/app/layout.tsx, themes.css): a display face for titles,
 * a body face, IBM Plex Mono for references. Android picks a weight by file, so each weight is
 * its own family; only the weights the web uses are bundled.
 */
const FILES = {
  Sora_700Bold, Sora_800ExtraBold,
  SpaceGrotesk_700Bold,
  Baloo2_700Bold, Baloo2_800ExtraBold,
  SourceSerif4_700Bold,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold,
  NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold, NotoSans_700Bold,
  IBMPlexMono_500Medium, IBMPlexMono_600SemiBold,
} as const;

type Family = keyof typeof FILES;

const body = (face: "Inter" | "IBMPlexSans" | "NotoSans") => ({
  body: `${face}_400Regular`,
  bodyMedium: `${face}_500Medium`,
  bodySemibold: `${face}_600SemiBold`,
  bodyBold: `${face}_700Bold`,
});
const mono = { mono: "IBMPlexMono_500Medium", monoBold: "IBMPlexMono_600SemiBold" };

const BY_THEME: Record<ThemeName, ThemeFonts> = {
  hazard: { display: "Sora_700Bold", displayHeavy: "Sora_800ExtraBold", ...body("Inter"), ...mono },
  "control-room": { display: "SpaceGrotesk_700Bold", displayHeavy: "SpaceGrotesk_700Bold", ...body("IBMPlexSans"), ...mono },
  setu: { display: "Baloo2_700Bold", displayHeavy: "Baloo2_800ExtraBold", ...body("NotoSans"), ...mono },
  "ledger-slate": { display: "SourceSerif4_700Bold", displayHeavy: "SourceSerif4_700Bold", ...body("Inter"), ...mono },
};

export function themeFonts(theme: ThemeName, style: VisualStyle): ThemeFonts {
  const fonts = BY_THEME[theme];
  // Strict style sets titles in IBM Plex Sans, as on the web.
  return style === "strict" ? { ...fonts, display: "IBMPlexSans_700Bold", displayHeavy: "IBMPlexSans_700Bold" } : fonts;
}

/** The font files a theme needs, for expo-font's useFonts. */
export function fontFiles(fonts: ThemeFonts): Partial<Record<Family, number>> {
  return Object.fromEntries(Object.values(fonts).map((family) => [family, FILES[family as Family]]));
}
