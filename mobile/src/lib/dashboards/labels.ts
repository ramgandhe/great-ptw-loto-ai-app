import type { KpiItem } from "./types";

const KPI_LABELS: Record<string, string> = {
  active_permits: "Active permits",
  pending_approvals: "Pending approvals",
  suspended_permits: "Suspended permits",
  open_incidents: "Open incidents",
  closed_incidents: "Closed incidents",
};

export function kpiLabel(item: KpiItem): string {
  return KPI_LABELS[item.key] ?? item.key.replace(/_/g, " ");
}

export function kpiCount(item: KpiItem): number | string {
  if (typeof item.value.count === "number") {
    return item.value.count;
  }
  return "—";
}
