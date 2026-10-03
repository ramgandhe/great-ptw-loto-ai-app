import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "@/components/ui/icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectivityBanner } from "@/components/offline/connectivity-banner";
import { useTheme } from "@/providers/theme-provider";
import { blend, readable, tint } from "@/theme/tokens";
import { AppText } from "./text";

/**
 * A page: the theme's canvas, the offline banner, scrolling content with the standard gutter and
 * an optional action bar pinned to the bottom (Save / Submit, Approve…), as on the web at phone width.
 * Screens using it hide the native header and start with <PageHeader>.
 */
export function Screen({
  children,
  footer,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = { paddingHorizontal: tokens.space[4], paddingTop: tokens.space[3], gap: tokens.space[5] };
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: tokens.colors.background }}>
      <ConnectivityBanner />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[padding, { paddingBottom: (footer ? 0 : insets.bottom) + tokens.space[8] }, contentStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={tokens.colors.primary} colors={[tokens.colors.primary]} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

/** The quiet way back above a title: coloured, same place and wording on every page. */
export function BackLink({ label, href }: { label: string; href?: string }) {
  const { tokens } = useTheme();
  const accent = tokens.colors.primaryText;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Back to ${label}`}
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace((href ?? "/") as never))}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", opacity: pressed ? 0.7 : 1, minHeight: 32 })}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: tint(accent, 0.14), alignItems: "center", justifyContent: "center" }}>
        <ArrowLeft size={14} color={accent} />
      </View>
      <AppText variant="label" style={{ color: accent }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** The top of every page: back link, accent bar with a large title, a one-line description, actions. */
export function PageHeader({
  title,
  description,
  back,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  back?: { label: string; href?: string };
  actions?: ReactNode;
  /** Tabs, search and filters that belong with the title. */
  children?: ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.space[2] }}>
      {back ? <BackLink {...back} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3] }}>
        <View style={{ width: 6, alignSelf: "stretch", maxHeight: 34, minHeight: 26, borderRadius: 3, backgroundColor: tokens.colors.primary }} />
        <AppText variant="display" style={{ flex: 1 }}>
          {title}
        </AppText>
      </View>
      {description ? (
        <AppText variant="body" tone="secondary" style={{ paddingLeft: 18 }}>
          {description}
        </AppText>
      ) : null}
      {actions ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2], marginTop: tokens.space[2] }}>{actions}</View> : null}
      {children ? <View style={{ gap: tokens.space[3], marginTop: tokens.space[2] }}>{children}</View> : null}
    </View>
  );
}

/** A section inside a page: a coloured tick, the title, an optional count and description. */
export function SectionTitle({ title, description, color, count, action }: { title: string; description?: string; color?: string; count?: number; action?: ReactNode }) {
  const { tokens } = useTheme();
  const tick = color ?? tokens.colors.primary;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: tokens.space[3] }}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[2] }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: tick }} />
          <AppText variant="heading">{title}</AppText>
          {count !== undefined ? (
            <View style={{ paddingHorizontal: 8, borderRadius: 999, backgroundColor: tint(tick, 0.13), borderWidth: 1, borderColor: tint(tick, 0.32) }}>
              <AppText variant="label" weight="bold" style={{ color: readable(tick, blend(tick, 0.13, tokens.colors.background)) }}>
                {count}
              </AppText>
            </View>
          ) : null}
        </View>
        {description ? <AppText variant="caption" style={{ paddingLeft: 16 }}>{description}</AppText> : null}
      </View>
      {action}
    </View>
  );
}

/**
 * A surface on the canvas, with the theme's radius, border and shadow. `accent` draws the
 * coloured edge the web uses for status and urgency; `onPress` makes the whole card open something.
 */
export function Card({
  children,
  accent,
  onPress,
  accessibilityLabel,
  padded = true,
  style,
}: {
  children: ReactNode;
  accent?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = useTheme();
  const surface: ViewStyle = {
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.borderWidth,
    borderColor: tokens.colors.border,
    padding: padded ? tokens.space[4] : 0,
    paddingLeft: padded ? tokens.space[4] + (accent ? 4 : 0) : 0,
    gap: tokens.space[2],
    ...tokens.shadow,
  };
  const edge = accent ? <View style={{ position: "absolute", left: 0, top: tokens.space[3], bottom: tokens.space[3], width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: accent }} /> : null;
  if (!onPress) {
    return (
      <View style={[surface, style]}>
        {edge}
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [surface, { transform: [{ scale: pressed ? 0.985 : 1 }], opacity: pressed ? 0.94 : 1 }, style]}
    >
      {edge}
      {children}
    </Pressable>
  );
}

/** The bar pinned to the bottom of a form or decision page: its main actions, always in reach. */
export function ActionBar({ children }: { children: ReactNode }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: tokens.space[2],
        paddingHorizontal: tokens.space[4],
        paddingTop: tokens.space[3],
        paddingBottom: insets.bottom + tokens.space[3],
        backgroundColor: tokens.colors.card,
        borderTopWidth: 1,
        borderTopColor: tokens.colors.borderSubtle,
      }}
    >
      {children}
    </View>
  );
}

/** A whole page that is still loading, or could not load (with the way back and a retry). */
export function ScreenState({ error, back, onRetry }: { error?: string | null; back?: { label: string; href?: string }; onRetry?: () => void }) {
  const { tokens } = useTheme();
  return (
    <Screen>
      {back ? <BackLink {...back} /> : null}
      {error ? (
        <View style={{ gap: tokens.space[3] }}>
          <AppText variant="title">Could not load this page</AppText>
          <AppText variant="body" tone="secondary">{error}</AppText>
          {onRetry ? (
            <Pressable accessibilityRole="button" onPress={onRetry} style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}>
              <AppText variant="label" tone="accent">Try again</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[10] }} />
      )}
    </Screen>
  );
}
