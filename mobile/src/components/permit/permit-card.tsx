import { View } from "react-native";
import { MapPin } from "@/components/ui/icons";
import { AppText, Button, Card, Chip, ChipRow, PermitStatusChip, PermitTypeChip, RefChip } from "@/components/ui";
import { formatWindow } from "@/lib/format";
import type { useOrgNames } from "@/lib/permit/names";
import type { PermitRecord } from "@/lib/permit/types";
import { useTheme } from "@/providers/theme-provider";

/**
 * A permit in a list (web work-queue row and permit card): title, status, reference and type,
 * place and dates, and the one thing to do with it. `accent` is the coloured edge (status or urgency).
 */
export function PermitCard({
  permit,
  names,
  accent,
  action,
  offline = false,
  onPress,
}: {
  permit: PermitRecord;
  names: ReturnType<typeof useOrgNames>;
  accent?: string;
  action?: { label: string; color: string; solid?: boolean; onPress: () => void };
  /** Made offline: not on the server yet, so it has no status there. */
  offline?: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const type = names.permitType(permit.permitTypeId);
  return (
    <Card accent={accent} onPress={onPress} accessibilityLabel={`${permit.title}${permit.reference ? `, ${permit.reference}` : ""}`}>
      <AppText variant="subheading">{permit.title}</AppText>
      <ChipRow>
        {offline ? <Chip label="Saved on this phone" color={tokens.colors.warning} dot /> : <PermitStatusChip status={permit.status} />}
        <RefChip reference={permit.reference} />
        {type ? <PermitTypeChip name={type.name} color={type.color} /> : null}
      </ChipRow>
      {permit.locationId ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MapPin size={14} color={tokens.colors.mutedForeground} />
          <AppText variant="caption">{names.location(permit.locationId)}</AppText>
        </View>
      ) : null}
      <AppText variant="caption">{formatWindow(permit.plannedStartAt, permit.plannedEndAt)}</AppText>
      {action ? (
        <View style={{ alignItems: "flex-end", marginTop: tokens.space[1] }}>
          <Button label={action.label} variant={action.solid ? "primary" : "tint"} color={action.color} size="sm" onPress={action.onPress} />
        </View>
      ) : null}
    </Card>
  );
}
