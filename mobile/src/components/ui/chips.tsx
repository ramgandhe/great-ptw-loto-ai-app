import { View } from "react-native";
import { type LucideIcon, ArrowUpFromLine, Container, Flame, Shovel, Snowflake, TriangleAlert, Truck, Wrench, Zap } from "@/components/ui/icons";
import { permitStatusLabel, typeFamily, type TypeFamily } from "@/lib/permit/status";
import { toneOf, type SafetyStatusMap } from "@/lib/safety-status";
import { useTheme } from "@/providers/theme-provider";
import { blend, readable, tint } from "@/theme/tokens";
import { AppText } from "./text";

type IconType = LucideIcon;

/** The one soft chip, tinted in its colour (web .chip): status, type, counts and filters render it. */
export function Chip({ label, color, dot = false, icon: Icon, square = false }: { label: string; color: string; dot?: boolean; icon?: IconType; square?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderRadius: square ? tokens.radii.xs : 999,
        backgroundColor: tint(color, 0.13),
        borderWidth: 1,
        borderColor: tint(color, 0.32),
        maxWidth: "100%",
      }}
    >
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} /> : null}
      {Icon ? <Icon size={13} color={color} strokeWidth={2.2} /> : null}
      <AppText variant="label" weight="semibold" numberOfLines={1} style={{ color: readable(color, blend(color, 0.13, tokens.colors.card)), fontSize: tokens.text.xs }}>
        {label}
      </AppText>
    </View>
  );
}

/** A permit's status with its lifecycle colour, as on the web. */
export function PermitStatusChip({ status }: { status: string }) {
  const { tokens } = useTheme();
  return <Chip label={permitStatusLabel(status)} color={tokens.status[status] ?? tokens.colors.mutedForeground} dot />;
}

const TYPE_ICONS: Record<TypeFamily, IconType> = {
  hot: Flame,
  electrical: Zap,
  hazardous: TriangleAlert,
  confined: Container,
  height: ArrowUpFromLine,
  excavation: Shovel,
  lifting: Truck,
  cold: Snowflake,
  general: Wrench,
};

/** A permit type: the organisation's colour for it (or its family's) and the family icon. */
export function PermitTypeChip({ name, color }: { name: string; color?: string | null }) {
  const family = typeFamily(name);
  return <Chip label={name} color={color || family.color} icon={TYPE_ICONS[family.key]} square />;
}

/** A permit reference in the mono face; drafts have none yet. */
export function RefChip({ reference }: { reference: string | null | undefined }) {
  const { tokens } = useTheme();
  return (
    <View style={{ alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 1, borderRadius: tokens.radii.xs, backgroundColor: tokens.colors.muted }}>
      <AppText variant="mono" style={{ color: reference ? tokens.colors.foreground : tokens.colors.mutedForeground }}>
        {reference ?? "No reference yet"}
      </AppText>
    </View>
  );
}

/** Chips in a wrapping row. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>{children}</View>;
}

/** A LOTOTO, isolation, incident or SIMOPS status in its permit colour family (see safety-status.ts). */
export function SafetyStatusChip({ map, status }: { map: SafetyStatusMap; status: string }) {
  const { tokens } = useTheme();
  const tone = toneOf(map, status);
  return <Chip label={tone.label} color={tokens.status[tone.key] ?? tokens.colors.mutedForeground} dot />;
}

/** High / medium / low, on the web's severity scale. */
export function SeverityChip({ severity }: { severity: string }) {
  const { tokens } = useTheme();
  const c = tokens.colors;
  const color = severity === "high" || severity === "critical" ? c.danger : severity === "medium" ? c.warning : c.mutedForeground;
  return <Chip label={`${severity.charAt(0).toUpperCase()}${severity.slice(1)} severity`} color={color} icon={TriangleAlert} />;
}
