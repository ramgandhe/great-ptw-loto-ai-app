import { StatusChip } from "@/components/ui/status-chip";
import { SEVERITY, toneOf } from "@/lib/safety/status";

export function ConflictSeverityBadge({ severity }: { severity: string }) {
  const tone = toneOf(SEVERITY, severity);
  return <StatusChip label={`${tone.label} severity`} color={tone.color} />;
}
