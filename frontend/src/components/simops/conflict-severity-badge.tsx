import { cn } from "@/lib/utils";
import type { ConflictSeverity } from "@/lib/simops/types";

const labels: Record<ConflictSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function ConflictSeverityBadge({ severity }: { severity: ConflictSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        severity === "low" && "border-muted-foreground/30 bg-muted text-muted-foreground",
        severity === "medium" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        severity === "high" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {labels[severity]} severity
    </span>
  );
}
