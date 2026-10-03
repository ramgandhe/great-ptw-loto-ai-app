import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { CircleAlert, CircleCheck, FileText, Info, TriangleAlert } from "@/components/ui/icons";
import { useTheme } from "@/providers/theme-provider";
import { tint } from "@/theme/tokens";
import { AppText } from "./text";

type Tone = "info" | "warning" | "danger" | "success";

/** A message across the page: draft notice, offline changes, could-not-load (web Alert). */
export function Banner({ tone = "info", title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const { tokens } = useTheme();
  const c = tokens.colors;
  const { fg, bg, Icon } = {
    info: { fg: c.info, bg: c.infoBg, Icon: Info },
    warning: { fg: c.warning, bg: c.warningBg, Icon: TriangleAlert },
    danger: { fg: c.danger, bg: c.dangerBg, Icon: CircleAlert },
    success: { fg: c.success, bg: c.successBg, Icon: CircleCheck },
  }[tone];
  return (
    <View
      accessibilityRole={tone === "danger" || tone === "warning" ? "alert" : undefined}
      style={{ flexDirection: "row", gap: tokens.space[3], padding: tokens.space[4], borderRadius: tokens.radii.md, backgroundColor: bg, borderWidth: 1, borderColor: tint(fg, 0.35) }}
    >
      <Icon size={18} color={fg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <AppText variant="label" style={{ color: fg }}>{title}</AppText> : null}
        {typeof children === "string" ? <AppText variant="caption" style={{ color: fg }}>{children}</AppText> : children}
        {action ? <View style={{ marginTop: 4, alignSelf: "flex-start" }}>{action}</View> : null}
      </View>
    </View>
  );
}

/** What an empty list says: what will appear here, and the way to start. */
export function EmptyState({ title, body, action, done = false }: { title: string; body?: string; action?: ReactNode; done?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: tokens.space[3], padding: tokens.space[5], borderRadius: tokens.radii.lg, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.colors.borderStrong }}>
      {done ? <CircleCheck size={22} color={tokens.colors.success} /> : null}
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="body" weight="semibold">{title}</AppText>
        {body ? <AppText variant="caption">{body}</AppText> : null}
        {action ? <View style={{ marginTop: tokens.space[2], alignSelf: "flex-start" }}>{action}</View> : null}
      </View>
    </View>
  );
}

/** Segmented tabs with counts (web list views): the selected one is solid. */
export function Tabs<K extends string>({ options, value, onChange }: { options: { key: K; label: string; count?: number }[]; value: K; onChange: (key: K) => void }) {
  const { tokens } = useTheme();
  const c = tokens.colors;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: 4, paddingVertical: 2 }}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.count === undefined ? option.label : `${option.label}, ${option.count}`}
            onPress={() => onChange(option.key)}
            style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: tokens.radii.full, backgroundColor: selected ? c.foreground : "transparent" }}
          >
            <AppText variant="label" style={{ color: selected ? c.background : c.textSecondary }}>{option.label}</AppText>
            {option.count !== undefined ? (
              <AppText variant="label" weight="medium" style={{ color: selected ? c.background : c.mutedForeground }}>{option.count}</AppText>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Facts about a record, label above value (the web's summary lists). Empty values are left out. */
export function InfoList({ rows }: { rows: [label: string, value: ReactNode][] }) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.space[3] }}>
      {rows
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([label, value]) => (
          <View key={label} style={{ gap: 2 }}>
            <AppText variant="caption">{label}</AppText>
            {typeof value === "string" || typeof value === "number" ? <AppText variant="body" weight="medium">{value}</AppText> : value}
          </View>
        ))}
    </View>
  );
}

/** How far through something is: a bar and "2 of 5". */
export function ProgressBar({ value, total, label, color }: { value: number; total: number; label?: string; color?: string }) {
  const { tokens } = useTheme();
  const share = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={{ gap: tokens.space[1] }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: value }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: tokens.colors.muted, overflow: "hidden" }}>
        <View style={{ width: `${share * 100}%`, height: 8, borderRadius: 4, backgroundColor: color ?? tokens.colors.primary }} />
      </View>
      <AppText variant="caption">{label ?? `${value} of ${total}`}</AppText>
    </View>
  );
}

/** One entry in a history: a dot on a line, what happened, when, and any detail. */
export function TimelineItem({ title, time, color, last = false, children }: { title: string; time?: string; color?: string; last?: boolean; children?: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: tokens.space[3] }}>
      <View style={{ alignItems: "center", width: 14 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 5, backgroundColor: color ?? tokens.colors.primary }} />
        {last ? null : <View style={{ flex: 1, width: 2, marginTop: 4, backgroundColor: tokens.colors.border }} />}
      </View>
      <View style={{ flex: 1, gap: 4, paddingBottom: last ? 0 : tokens.space[5] }}>
        <AppText variant="body" weight="semibold">{title}</AppText>
        {children}
        {time ? <AppText variant="caption">{time}</AppText> : null}
      </View>
    </View>
  );
}

/** A file you can open: its name and an Open button that shows when it is fetching. */
export function FileRow({ name, busy, onOpen }: { name: string; busy?: boolean; onOpen: () => void }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3], minHeight: 48 }}>
      <FileText size={18} color={tokens.colors.mutedForeground} />
      <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>{name}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`} disabled={busy} onPress={onOpen} hitSlop={8} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: tokens.space[2] }}>
        <AppText variant="label" tone="accent">{busy ? "Opening…" : "Open"}</AppText>
      </Pressable>
    </View>
  );
}
