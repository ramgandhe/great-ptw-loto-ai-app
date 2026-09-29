import { cn } from "@/lib/utils";

export type RecordState = "active" | "inactive" | "deleted";

/**
 * One reading of "is this record in use" across admin lists. Records use different flags
 * (status active/inactive/disabled/archived, isActive, enabled); people only see three states.
 * Inactive: listed, not offered on permits and forms. Deleted: gone from lists, kept for history.
 */
export function stateOf(record: { status?: string | null; isActive?: boolean | null; enabled?: boolean | null }): RecordState {
  if (record.status === "archived") return "deleted";
  if (record.status === "inactive" || record.status === "disabled" || record.isActive === false || record.enabled === false) {
    return "inactive";
  }
  return "active";
}

/** Only records in use belong in pick lists. */
export const inUse = (record: Parameters<typeof stateOf>[0]) => stateOf(record) === "active";

const styles: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  current: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  draft: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  inactive: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  deleted: "bg-muted text-muted-foreground",
};
const LABELS: Record<string, string> = { disabled: "inactive", archived: "deleted" };

export function OrgStatusBadge({ status = "active" }: { status?: string }) {
  const key = LABELS[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[key] ?? "bg-secondary text-secondary-foreground",
      )}
    >
      {key.replace(/_/g, " ")}
    </span>
  );
}
