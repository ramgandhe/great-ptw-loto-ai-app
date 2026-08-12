import type { IncidentStatus } from "@/lib/incidents/types";

const LABELS: Record<IncidentStatus, string> = {
  draft: "Draft",
  open: "Open",
  pending_hod_decision: "Pending HOD decision",
  investigating: "Investigating",
  pending_verification: "Pending verification",
  verified: "Verified",
  closed: "Closed",
};

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium">
      {LABELS[status]}
    </span>
  );
}
