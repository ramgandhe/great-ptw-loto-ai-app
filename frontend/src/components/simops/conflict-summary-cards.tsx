import type { ConflictType, SimopsConflict } from "@/lib/simops/types";
import { ConflictSeverityBadge } from "@/components/simops/conflict-severity-badge";

const TYPE_LABELS: Record<ConflictType, string> = {
  location: "Location",
  equipment: "Equipment",
  schedule: "Schedule",
  permit_type: "Permit type",
};

export function ConflictSummaryCards({ conflicts }: { conflicts: SimopsConflict[] }) {
  const bySeverity = {
    high: conflicts.filter((item) => item.severity === "high").length,
    medium: conflicts.filter((item) => item.severity === "medium").length,
    low: conflicts.filter((item) => item.severity === "low").length,
  };

  const byType = conflicts.reduce<Record<string, number>>((acc, item) => {
    acc[item.conflictType] = (acc[item.conflictType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Severity matrix</h2>
        <ul className="mt-3 space-y-2">
          {(["high", "medium", "low"] as const).map((severity) => (
            <li key={severity} className="flex items-center justify-between gap-3">
              <ConflictSeverityBadge severity={severity} />
              <span className="text-sm font-medium">{bySeverity[severity]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-muted-foreground">Conflict types</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <li key={type} className="flex items-center justify-between gap-3">
              <span>{label}</span>
              <span className="font-medium">{byType[type] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
