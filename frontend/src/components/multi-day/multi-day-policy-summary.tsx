"use client";

import type { DayCycleSnapshot } from "@/lib/multi-day/types";
import type { MultiDaySummary } from "@/lib/permit/types";

type MultiDayPolicySummaryProps = {
  multiDay?: MultiDaySummary | null;
  dayCycle?: DayCycleSnapshot | null;
};

export function MultiDayPolicySummary({ multiDay, dayCycle }: MultiDayPolicySummaryProps) {
  const source = multiDay ?? null;
  if (!source?.isMultiDay && !dayCycle?.isMultiDay) {
    return null;
  }

  const dailyAudit =
    dayCycle?.dailyRevalidationRequired ?? source?.dailyRevalidationRequired ?? true;
  const overrideAllowed =
    dayCycle?.emergencyOverrideAllowed ?? source?.emergencyOverrideAllowed ?? true;
  const cutoff =
    dayCycle?.operationalDayCutoff ?? source?.operationalDayCutoff ?? "16:30";
  const maxDays =
    dayCycle?.maxMultiDayValidityDays ?? source?.maxMultiDayValidityDays ?? 7;
  const dayNumber = dayCycle?.dayNumber ?? null;
  const timezone = dayCycle?.timezone ?? source?.timezone ?? "UTC";

  return (
    <dl className="grid gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="text-muted-foreground">Daily audit</dt>
        <dd className="font-medium">{dailyAudit ? "Required" : "Off (secure still required)"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Emergency override</dt>
        <dd className="font-medium">{overrideAllowed ? "Allowed" : "Disabled"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Day of validity</dt>
        <dd className="font-medium">
          {dayNumber != null ? `Day ${dayNumber} of ${maxDays}` : `Max ${maxDays} days`}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Operational cut-off</dt>
        <dd className="font-medium">
          {cutoff} ({timezone})
        </dd>
      </div>
    </dl>
  );
}
