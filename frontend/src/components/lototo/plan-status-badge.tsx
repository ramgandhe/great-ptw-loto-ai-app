import { StatusChip } from "@/components/ui/status-chip";
import { LOTOTO_PLAN_STATUS, toneOf } from "@/lib/safety/status";

export function PlanStatusBadge({ status }: { status: string }) {
  return <StatusChip {...toneOf(LOTOTO_PLAN_STATUS, status)} />;
}
