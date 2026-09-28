import { StatusChip } from "@/components/ui/status-chip";
import { permitStatusColor, permitStatusLabel } from "@/lib/permit/status";

export function PermitStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusChip label={permitStatusLabel(status)} color={permitStatusColor(status)} className={className} />;
}
