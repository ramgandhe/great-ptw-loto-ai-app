"use client";

import type { AnalyticsSnapshot } from "@/lib/dashboards/types";

interface TrendsPanelProps {
  points: AnalyticsSnapshot[];
  metricKey?: string;
}

function readMetric(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  return typeof value === "number" ? value : 0;
}

export function TrendsPanel({ points, metricKey = "activePermits" }: TrendsPanelProps) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No trend snapshots yet.</p>;
  }

  const values = points.map((point) => readMetric(point.payload, metricKey));
  const max = Math.max(1, ...values);

  return (
    <ul className="grid gap-3">
      {points.map((point) => {
        const value = readMetric(point.payload, metricKey);
        return (
          <li key={point.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {new Date(point.capturedAt).toLocaleString()}
              </span>
              <span className="font-medium tabular-nums">{value}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
