import { Pressable, ScrollView, View } from "react-native";
import { AppText } from "@/components/ui";
import { Check } from "@/components/ui/icons";
import { useTheme } from "@/providers/theme-provider";
import { tint } from "@/theme/tokens";

export type StepperPoint = { id: string; order: number; label: string; done: boolean; open: boolean };

/** Isolation points in their order, as numbered pills: done ticked, the current one ringed, closed ones dimmed. */
export function PointStepper({ points, selectedId, onSelect }: { points: StepperPoint[]; selectedId: string | undefined; onSelect: (id: string) => void }) {
  const { tokens } = useTheme();
  const c = tokens.colors;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space[2] }}>
      {points.map((p) => {
        const selected = p.id === selectedId;
        const closed = !p.open && !p.done;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`Point ${p.order}, ${p.label}${p.done ? ", done" : closed ? ", not open yet" : ""}`}
            accessibilityState={{ selected, disabled: closed }}
            disabled={closed}
            onPress={() => onSelect(p.id)}
            style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: tokens.space[2], paddingHorizontal: tokens.space[4], borderRadius: tokens.radii.full, borderWidth: selected ? 2 : 1, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? tint(c.primary, 0.1) : c.card, opacity: closed ? 0.45 : 1 }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: p.done ? c.success : selected ? c.primaryFill : c.card, borderWidth: p.done || selected ? 0 : 1, borderColor: c.borderStrong }}>
              {p.done ? <Check size={13} color={c.card} strokeWidth={3} /> : <AppText variant="label" maxFontSizeMultiplier={1.2} style={{ fontSize: 11, color: selected ? c.primaryForeground : c.mutedForeground }}>{p.order}</AppText>}
            </View>
            <AppText variant="label" weight={selected ? "bold" : "semibold"}>{p.label}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
