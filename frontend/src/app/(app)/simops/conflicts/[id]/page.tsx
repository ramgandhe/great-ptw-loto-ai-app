"use client";

import { BackLink } from "@/components/layout/page-header";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getSimopsConflict } from "@/lib/simops/api";
import type { ConflictDetail } from "@/lib/simops/types";
import { ConflictSeverityBadge } from "@/components/simops/conflict-severity-badge";
import { ConflictTimeline } from "@/components/simops/conflict-timeline";
import { ConflictWorkflow } from "@/components/simops/conflict-workflow";

export default function ConflictDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ConflictDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    if (!params.id) return Promise.resolve();

    return getSimopsConflict(params.id)
      .then(setDetail)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load conflict");
      });
  }, [params.id]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div>
        <BackLink href="/simops" label="SIMOPS" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{detail?.conflict.summary ?? "Work clash"}</h1>
          {detail ? <ConflictSeverityBadge severity={detail.conflict.severity} /> : null}
        </div>
        {detail ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.conflict.conflictType.replace(/_/g, " ")} clash · now {detail.conflict.status.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading conflict…</p>
      ) : detail ? (
        <>
          <section aria-labelledby="permits-heading" className="grid gap-3">
            <h2 id="permits-heading" className="text-lg font-semibold">
              Permits in this clash
            </h2>
            <ConflictTimeline participants={detail.participants} />
          </section>

          <ConflictWorkflow
            detail={detail}
            onUpdated={() => {
              setIsLoading(true);
              load().finally(() => setIsLoading(false));
            }}
          />

          <details className="rounded-xl border border-border bg-card px-5 py-3">
            <summary className="cursor-pointer text-sm font-semibold">Alerts sent ({detail.alerts.length})</summary>
            {detail.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts for this conflict.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {detail.alerts.map((alert) => (
                  <li key={alert.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.recipientRole} · {alert.status}
                      </p>
                    </div>
                    <ConflictSeverityBadge severity={alert.severity} />
                  </li>
                ))}
              </ul>
            )}
          </details>
        </>
      ) : null}
    </main>
  );
}
