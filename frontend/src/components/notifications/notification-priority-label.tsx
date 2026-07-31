import type { NotificationPriority } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

const LABELS: Record<NotificationPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

export function NotificationPriorityLabel({
  priority,
  className,
}: {
  priority: NotificationPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium",
        priority === "critical" && "border-destructive/40 text-destructive",
        priority === "high" && "border-amber-500/40 text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      {LABELS[priority]}
    </span>
  );
}
