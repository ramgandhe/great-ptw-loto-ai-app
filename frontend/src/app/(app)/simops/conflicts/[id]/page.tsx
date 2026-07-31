"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getSimopsConflict } from "@/lib/simops/api";
import type { ConflictDetail } from "@/lib/simops/types";
import { ConflictSeverityBadge } from "@/components/simops/conflict-severity-badge";
import { ConflictTimeline } from "@/components/simops/conflict-timeline";
import { ConflictWorkflow } from "@/components/simops/conflict-workflow";
import { Button } from "@/components/ui/button";

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
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Conflict details</h1>
          <p className="text-sm text-muted-foreground">Assess, plan mitigation, and resolve SIMOPS conflicts.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/simops/history">
            <Button variant="outline">History</Button>
          </Link>
          <Link href="/simops/conflicts">
            <Button variant="outline">Back to conflicts</Button>
          </Link>
        </div>
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
          <section className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{detail.conflict.summary}</p>
                <p className="text-sm text-muted-foreground">
                  Type: {detail.conflict.conflictType.replace(/_/g, " ")} · Status:{" "}
                  {detail.conflict.status.replace(/_/g, " ")}
                </p>
              </div>
              <ConflictSeverityBadge severity={detail.conflict.severity} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Permit timeline</h2>
            <ConflictTimeline participants={detail.participants} />
          </section>

          <ConflictWorkflow
            detail={detail}
            onUpdated={() => {
              setIsLoading(true);
              load().finally(() => setIsLoading(false));
            }}
          />

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Alerts</h2>
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
          </section>
        </>
      ) : null}
    </main>
  );
}
