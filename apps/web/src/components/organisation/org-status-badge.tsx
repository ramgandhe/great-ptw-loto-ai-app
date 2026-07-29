import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  archived: "bg-muted text-muted-foreground",
  draft: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function OrgStatusBadge({ status = "active" }: { status?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? "bg-secondary text-secondary-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
