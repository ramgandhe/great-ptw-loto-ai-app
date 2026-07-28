import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
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
