"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getSimopsHistoryRecord } from "@/lib/simops/api";
import type { ConflictDetail } from "@/lib/simops/types";
import { ConflictSeverityBadge } from "@/components/simops/conflict-severity-badge";
import { ConflictTimeline } from "@/components/simops/conflict-timeline";
import { Button } from "@/components/ui/button";

export default function SimopsHistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ConflictDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    getSimopsHistoryRecord(params.id)
      .then(setDetail)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load history record");
      })
      .finally(() => setIsLoading(false));
  }, [params.id]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Conflict history record</h1>
          <p className="text-sm text-muted-foreground">Immutable resolution record for audit.</p>
        </div>
        <Link href="/simops/history">
          <Button variant="outline">Back to history</Button>
        </Link>
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
        <p className="text-sm text-muted-foreground">Loading record…</p>
      ) : detail ? (
        <>
          <section className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{detail.conflict.summary}</p>
                <p className="text-sm text-muted-foreground">
                  Outcome: {detail.resolution?.outcome} · {detail.resolution?.comments}
                </p>
              </div>
              <ConflictSeverityBadge severity={detail.conflict.severity} />
            </div>
          </section>

          {detail.assessment ? (
            <section className="rounded-lg border border-border p-4">
              <h2 className="text-lg font-medium">Assessment</h2>
              <p className="mt-2 text-sm text-muted-foreground">{detail.assessment.riskSummary}</p>
            </section>
          ) : null}

          {detail.mitigation ? (
            <section className="rounded-lg border border-border p-4">
              <h2 className="text-lg font-medium">Mitigation plan</h2>
              <p className="mt-2 text-sm text-muted-foreground">{detail.mitigation.planSummary}</p>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Permit timeline</h2>
            <ConflictTimeline participants={detail.participants} />
          </section>

          <section className="rounded-lg border border-border p-4">
            <h2 className="text-lg font-medium">Activity log</h2>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {detail.history.map((entry) => (
                <li key={entry.id}>
                  {entry.action.replace(/_/g, " ")} · {new Date(entry.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
