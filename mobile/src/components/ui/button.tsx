import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import { blend, readable, tint } from "@/theme/tokens";
import { AppText } from "./text";

type IconType = LucideIcon;

/**
 * The app's button, as on the web: a pill in the theme's shape.
 * primary = the page's main action; secondary = sunken; outline; ghost (quiet);
 * danger = destructive, tinted; tint = a soft fill in `color` (the web's "Continue" and status actions).
 * `color` on primary gives a solid button in that colour (e.g. "Revise" in the sent-back colour).
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "tint";

export function Button({
  label,
  onPress,
  variant = "primary",
  color,
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  full = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  color?: string;
  size?: "sm" | "md" | "lg";
  icon?: IconType;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = useTheme();
  const c = tokens.colors;
  const hue = color ?? (variant === "danger" ? c.danger : c.primary);
  // Labels are kept readable on their own fill (see readable() in the theme).
  const soft = variant === "danger" ? (tokens.dark ? 0.2 : 0.1) : 0.13;
  const look: { bg: string; fg: string; border: string } = {
    primary: { bg: color ? readable(color, tokens.statusInk) : c.primaryFill, fg: color ? tokens.statusInk : c.primaryForeground, border: "transparent" },
    secondary: { bg: c.inputFill, fg: c.foreground, border: "transparent" },
    outline: { bg: c.card, fg: c.foreground, border: c.inputBorder },
    ghost: { bg: "transparent", fg: color ? readable(color, c.background) : c.foreground, border: "transparent" },
    danger: { bg: tint(hue, soft), fg: readable(hue, blend(hue, soft, c.card)), border: tint(hue, 0.25) },
    tint: { bg: tint(hue, soft), fg: readable(hue, blend(hue, soft, c.card)), border: tint(hue, 0.35) },
  }[variant];
  const height = { sm: 36, md: 44, lg: 52 }[size];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={size === "sm" ? 4 : 0}
      style={({ pressed }) => [
        {
          minHeight: height,
          paddingHorizontal: size === "sm" ? tokens.space[3] : tokens.space[5],
          paddingVertical: tokens.space[1],
          borderRadius: tokens.radii.full,
          backgroundColor: look.bg,
          borderWidth: 1,
          borderColor: look.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.space[2],
          alignSelf: full ? "stretch" : "auto",
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={look.fg} /> : Icon ? <Icon size={size === "sm" ? 16 : 18} color={look.fg} strokeWidth={2.2} /> : null}
      <AppText variant="label" weight="semibold" numberOfLines={2} style={{ textAlign: "center", flexShrink: 1, color: look.fg, fontSize: size === "lg" ? tokens.text.base : tokens.text.sm + 1 }}>
        {label}
      </AppText>
    </Pressable>
  );
}
