export const EDITABLE_PERMIT_STATUSES = ["draft", "deferred", "rejected"] as const;

export function isEditablePermitStatus(status: string): boolean {
  return (EDITABLE_PERMIT_STATUSES as readonly string[]).includes(status);
}

/**
 * Lifecycle stages people think in. Each stage owns one hue family, so statuses that mean
 * similar things look related (sent back = rose, closing = violet) and every status is distinct.
 */
export const PERMIT_STATUS_GROUPS = [
  { key: "draft", label: "Drafts" },
  { key: "approval", label: "Awaiting approval" },
  { key: "returned", label: "Sent back" },
  { key: "approved", label: "Approved" },
  { key: "live", label: "In progress" },
  { key: "closing", label: "Closing" },
  { key: "done", label: "Finished" },
] as const;

export type PermitStatusGroup = (typeof PERMIT_STATUS_GROUPS)[number]["key"];

/**
 * The one list of permit statuses: lifecycle order, stage group, the name people see, and the
 * colour token. The status badge, the process map, charts, reports and the home page all read it.
 */
export const PERMIT_STATUSES = [
  { key: "draft", group: "draft", label: "Draft" },
  { key: "pending_approval", group: "approval", label: "Pending approval" },
  { key: "deferred", group: "returned", label: "Deferred" },
  { key: "rejected", group: "returned", label: "Rejected" },
  { key: "approved", group: "approved", label: "Approved" },
  { key: "active", group: "live", label: "Work in progress" },
  { key: "suspended", group: "live", label: "Suspended" },
  { key: "execution_completed", group: "closing", label: "Work finished" },
  { key: "pending_closure", group: "closing", label: "Final sign-off" },
  { key: "closed", group: "done", label: "Closed" },
  { key: "expired", group: "done", label: "Expired" },
  { key: "cancelled", group: "done", label: "Cancelled" },
].map((s) => ({ ...s, fill: `--st-${s.key}`, ink: "--st-ink" })) as {
  key: string;
  group: PermitStatusGroup;
  label: string;
  fill: string;
  ink: string;
}[];

export type PermitStatusInfo = (typeof PERMIT_STATUSES)[number];

export const PERMIT_STATUS_BY_KEY = new Map<string, PermitStatusInfo>(PERMIT_STATUSES.map((s) => [s.key, s]));

export function permitStatusLabel(status: string): string {
  return PERMIT_STATUS_BY_KEY.get(status)?.label ?? status.replace(/_/g, " ");
}

/** The colour that stands for a status in a chart, dot, rule or chip. */
export function permitStatusColor(status: string): string {
  return PERMIT_STATUS_BY_KEY.has(status) ? `var(--st-${status})` : "var(--muted-foreground)";
}

export function statusesInGroup(group: string): string[] {
  return PERMIT_STATUSES.filter((s) => s.group === group).map((s) => s.key);
}
