import { StatusChip } from "@/components/ui/status-chip";
import { INCIDENT_STATUS, toneOf } from "@/lib/safety/status";

export function IncidentStatusBadge({ status }: { status: string }) {
  return <StatusChip {...toneOf(INCIDENT_STATUS, status)} />;
}
