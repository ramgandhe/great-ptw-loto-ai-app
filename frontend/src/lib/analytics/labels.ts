/** Lifecycle order and colours shared by analytics, reports and the permit badges. */
export const PERMIT_STAGES: { key: string; label: string; color: string }[] = [
  { key: "draft", label: "Draft", color: "var(--permit-draft-bg)" },
  { key: "pending_approval", label: "Pending approval", color: "var(--permit-pending-bg)" },
  { key: "deferred", label: "Sent back", color: "var(--status-info)" },
  { key: "rejected", label: "Rejected", color: "var(--permit-rejected-bg)" },
  { key: "approved", label: "Approved", color: "var(--permit-approved-bg)" },
  { key: "active", label: "Active", color: "var(--permit-active-bg)" },
  { key: "suspended", label: "Suspended", color: "var(--status-warning)" },
  { key: "execution_completed", label: "Work finished", color: "var(--vivid-3)" },
  { key: "pending_closure", label: "Awaiting sign-off", color: "var(--vivid-6)" },
  { key: "closed", label: "Closed", color: "var(--permit-closed-bg)" },
  { key: "expired", label: "Expired", color: "var(--permit-expired-bg)" },
  { key: "cancelled", label: "Cancelled", color: "var(--muted-foreground)" },
];

export const INCIDENT_TYPES: Record<string, { label: string; color: string }> = {
  incident: { label: "Incident", color: "var(--status-danger)" },
  near_miss: { label: "Near miss", color: "var(--status-warning)" },
  unsafe_condition: { label: "Unsafe condition", color: "var(--status-info)" },
};

export const PRIORITIES: { key: string; label: string; color: string }[] = [
  { key: "critical", label: "Critical", color: "var(--status-danger)" },
  { key: "high", label: "High", color: "var(--vivid-4)" },
  { key: "medium", label: "Medium", color: "var(--status-warning)" },
  { key: "low", label: "Low", color: "var(--muted-foreground)" },
];

export const SEVERITIES: Record<string, { label: string; color: string }> = {
  high: { label: "High", color: "var(--status-danger)" },
  medium: { label: "Medium", color: "var(--status-warning)" },
  low: { label: "Low", color: "var(--muted-foreground)" },
};

export const PERIODS = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];
