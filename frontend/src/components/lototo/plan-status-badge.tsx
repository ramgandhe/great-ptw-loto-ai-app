import { cn } from "@/lib/utils";
import type { LototoPlanStatus } from "@/lib/lototo/types";

const labels: Record<LototoPlanStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  in_execution: "In execution",
  completed: "Completed",
};

export function PlanStatusBadge({ status }: { status: LototoPlanStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        status === "draft" && "border-muted-foreground/30 bg-muted text-muted-foreground",
        status === "ready" && "border-primary/30 bg-primary/10 text-primary",
        status === "in_execution" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        status === "completed" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {labels[status]}
    </span>
  );
}
