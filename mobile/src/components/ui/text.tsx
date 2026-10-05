import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import type { ThemeTokens } from "@/theme/types";

/**
 * The app's text styles, matching the web's type scale and fonts:
 * display (page titles), title, heading (section titles), subheading (card titles),
 * body, label (field labels, buttons), caption (secondary lines), mono (references).
 */
export type TextVariant = "display" | "title" | "heading" | "subheading" | "body" | "label" | "caption" | "mono";
export type TextTone = "default" | "secondary" | "muted" | "accent" | "danger" | "success" | "warning" | "info" | "onPrimary";
export type TextWeight = "regular" | "medium" | "semibold" | "bold";

export function textStyle(tokens: ThemeTokens, variant: TextVariant, tone: TextTone = "default", weight?: TextWeight): TextStyle {
  const { fonts, text, colors } = tokens;
  const color = {
    default: colors.foreground,
    secondary: colors.textSecondary,
    muted: colors.mutedForeground,
    accent: colors.primaryText,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    info: colors.info,
    onPrimary: colors.primaryForeground,
  }[tone];
  const bodyFont = { regular: fonts.body, medium: fonts.bodyMedium, semibold: fonts.bodySemibold, bold: fonts.bodyBold };
  const size = (fontSize: number, lineHeight: number) => ({ fontSize, lineHeight: Math.round(fontSize * lineHeight) });
  switch (variant) {
    case "display":
      return { color, fontFamily: fonts.displayHeavy, letterSpacing: tokens.displayTracking, ...size(text.xxl, 1.15) };
    case "title":
      return { color, fontFamily: fonts.display, letterSpacing: tokens.displayTracking, ...size(text.lg, 1.2) };
    case "heading":
      return { color, fontFamily: fonts.display, ...size(text.md, 1.3) };
    case "subheading":
      return { color, fontFamily: bodyFont[weight ?? "bold"], ...size(text.md, 1.3) };
    case "label":
      return { color, fontFamily: bodyFont[weight ?? "semibold"], ...size(text.sm, 1.35) };
    case "caption":
      return { color: tone === "default" ? colors.mutedForeground : color, fontFamily: bodyFont[weight ?? "regular"], ...size(text.sm, 1.45) };
    case "mono":
      return { color, fontFamily: weight === "regular" ? fonts.mono : fonts.monoBold, ...size(text.xs, 1.4) };
    default:
      return { color, fontFamily: bodyFont[weight ?? "regular"], ...size(text.base, 1.5) };
  }
}

export function AppText({
  variant = "body",
  tone = "default",
  weight,
  style,
  ...props
}: TextProps & { variant?: TextVariant; tone?: TextTone; weight?: TextWeight }) {
  const { tokens } = useTheme();
  return (
    <Text
      accessibilityRole={variant === "display" || variant === "title" || variant === "heading" ? "header" : props.accessibilityRole}
      maxFontSizeMultiplier={1.6}
      {...props}
      style={[textStyle(tokens, variant, tone, weight), style]}
    />
  );
}
