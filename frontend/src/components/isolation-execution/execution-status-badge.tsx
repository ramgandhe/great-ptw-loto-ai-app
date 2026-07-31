import { cn } from "@/lib/utils";
import type { IsolationExecutionStatus } from "@/lib/isolation-execution/types";

const labels: Record<IsolationExecutionStatus, string> = {
  in_progress: "In progress",
  isolated: "Isolated",
  verified: "Verified",
  restored: "Restored",
};

export function ExecutionStatusBadge({ status }: { status: IsolationExecutionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        status === "in_progress" && "border-primary/30 bg-primary/10 text-primary",
        status === "isolated" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        status === "verified" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        status === "restored" && "border-muted-foreground/30 bg-muted text-muted-foreground",
      )}
    >
      {labels[status]}
    </span>
  );
}
