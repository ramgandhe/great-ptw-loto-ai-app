import { formatMetricKey } from "@/lib/billing/labels";
import type { UsageRecord } from "@/lib/billing/types";

type UsageMeterProps = {
  records: UsageRecord[];
  limits?: Record<string, unknown>;
};

function resolveLimit(limits: Record<string, unknown> | undefined, metricKey: string): number | null {
  if (!limits) {
    return null;
  }

  const value = limits[metricKey];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

export function UsageMeter({ records, limits }: UsageMeterProps) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No usage recorded for this tenant yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {records.map((record) => {
        const limit = resolveLimit(limits, record.metricKey);
        const percent =
          limit && limit > 0 ? Math.min(100, Math.round((record.quantity / limit) * 100)) : null;

        return (
          <li key={record.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{formatMetricKey(record.metricKey)}</p>
              <p className="text-sm text-muted-foreground">Period {record.periodLabel}</p>
            </div>

            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {record.quantity.toLocaleString()}
              {limit !== null ? (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {limit.toLocaleString()}
                </span>
              ) : null}
            </p>

            {percent !== null ? (
              <div className="mt-3">
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label={`${formatMetricKey(record.metricKey)} usage`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{percent}% of plan limit</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Last recorded {new Date(record.recordedAt).toLocaleString()}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
