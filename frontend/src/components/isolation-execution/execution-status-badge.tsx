import { StatusChip } from "@/components/ui/status-chip";
import { ISOLATION_STATUS, toneOf } from "@/lib/safety/status";

export function ExecutionStatusBadge({ status }: { status: string }) {
  return <StatusChip {...toneOf(ISOLATION_STATUS, status)} />;
}
