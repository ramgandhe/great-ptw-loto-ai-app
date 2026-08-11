import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  draft: "bg-[var(--permit-draft-bg)] text-[var(--permit-draft)]",
  pending_approval: "bg-[var(--permit-pending-bg)] text-[var(--permit-pending)]",
  approved: "bg-[var(--permit-approved-bg)] text-[var(--permit-approved)]",
  active: "bg-[var(--permit-active-bg)] text-[var(--permit-active)]",
  suspended: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  rejected: "bg-[var(--permit-rejected-bg)] text-[var(--permit-rejected)]",
  deferred: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  closed: "bg-[var(--permit-closed-bg)] text-[var(--permit-closed)]",
  expired: "bg-[var(--permit-expired-bg)] text-[var(--permit-expired)]",
};

export function PermitStatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        statusStyles[status] ?? "bg-secondary text-secondary-foreground",
      )}
    >
      {label}
    </span>
  );
}
