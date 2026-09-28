import { PERMIT_STATUSES, permitStatusColor } from "@/lib/permit/status";

/** Lifecycle order, names and colours: the same as the permit badges and the process map. */
export const PERMIT_STAGES: { key: string; label: string; color: string }[] = PERMIT_STATUSES.map((s) => ({
  key: s.key,
  label: s.label,
  color: permitStatusColor(s.key),
}));

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
