"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getAnalytics, getAnalyticsTrends } from "@/lib/dashboards/api";
import { ANALYTICS_SCOPE_LABELS } from "@/lib/dashboards/labels";
import type { AnalyticsPayload, AnalyticsScope, AnalyticsTrendsPayload } from "@/lib/dashboards/types";
import { TrendsPanel } from "@/components/dashboards/trends-panel";
import { Button } from "@/components/ui/button";

const SCOPES: AnalyticsScope[] = ["operational", "permits", "incidents", "lototo", "simops"];

export default function AnalyticsPage() {
  const [scope, setScope] = useState<AnalyticsScope>("operational");
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [trends, setTrends] = useState<AnalyticsTrendsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);

    Promise.all([getAnalytics(scope), getAnalyticsTrends(scope, 10)])
      .then(([analyticsData, trendsData]) => {
        setAnalytics(analyticsData);
        setTrends(trendsData);
      })
      .catch((err) => {
        setAnalytics(null);
        setTrends(null);
        setError(err instanceof ApiError ? err.message : "Failed to load analytics");
      })
      .finally(() => setIsLoading(false));
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const livePayload = analytics?.payload ?? analytics?.snapshot?.payload ?? {};

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Historical trends and live operational metrics by scope.
          </p>
        </div>
        <Link href="/">
          <Button type="button" variant="outline" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Analytics scope">
        {SCOPES.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={scope === value ? "default" : "outline"}
            onClick={() => setScope(value)}
          >
            {ANALYTICS_SCOPE_LABELS[value]}
          </Button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold">Current view</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Source: {analytics?.source ?? "—"} · captured{" "}
              {analytics?.capturedAt ? new Date(analytics.capturedAt).toLocaleString() : "—"}
            </p>
            <dl className="mt-4 grid gap-2 text-sm">
              {Object.entries(livePayload).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-medium tabular-nums">{String(value)}</dd>
                </div>
              ))}
              {Object.keys(livePayload).length === 0 ? (
                <p className="text-muted-foreground">No live metrics for this scope.</p>
              ) : null}
            </dl>
          </section>

          <section className="rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold">Trend history</h2>
            <p className="mt-1 text-xs text-muted-foreground">Active permits over recent snapshots</p>
            <div className="mt-4">
              <TrendsPanel points={trends?.points ?? []} metricKey="activePermits" />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
