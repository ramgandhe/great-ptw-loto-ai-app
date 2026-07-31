"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  listDailyActivityHistory,
  listDailyProgress,
  listHandovers,
  listRevalidationHistory,
} from "@/lib/multi-day/api";
import type {
  DailyActivityEvent,
  DailyProgressRecord,
  RevalidationHistoryEvent,
  ShiftHandoverRecord,
} from "@/lib/multi-day/types";
import { getPermit } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";
import {
  DailyActivityTimeline,
  RevalidationHistoryTimeline,
} from "@/components/multi-day/activity-timeline";
import { DailyProgressForm } from "@/components/multi-day/daily-progress-form";
import { HandoverForm } from "@/components/multi-day/handover-form";
import { RevalidationWorkflow } from "@/components/multi-day/revalidation-workflow";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export default function MultiDayPermitPage() {
  const params = useParams<{ id: string }>();
  const permitId = params.id;

  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [progress, setProgress] = useState<DailyProgressRecord[]>([]);
  const [handovers, setHandovers] = useState<ShiftHandoverRecord[]>([]);
  const [dailyHistory, setDailyHistory] = useState<DailyActivityEvent[]>([]);
  const [revalidationHistory, setRevalidationHistory] = useState<RevalidationHistoryEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const permitDetail = await getPermit(permitId);
    setDetail(permitDetail);

    if (["active", "suspended"].includes(permitDetail.permit.status)) {
      const [progressRows, handoverRows, activityRows, revalidationRows] = await Promise.all([
        listDailyProgress(permitId),
        listHandovers(permitId),
        listDailyActivityHistory(permitId),
        listRevalidationHistory(permitId),
      ]);
      setProgress(progressRows);
      setHandovers(handoverRows);
      setDailyHistory(activityRows);
      setRevalidationHistory(revalidationRows);
    }
  }, [permitId]);

  useEffect(() => {
    load().catch((err) => {
      setError(err instanceof ApiError ? err.message : "Failed to load multi-day permit data");
    });
  }, [load]);

  if (error) {
    return (
      <div className="p-8 text-sm text-destructive" role="alert">
        {error}
      </div>
    );
  }

  if (!detail) {
    return <p className="p-8 text-sm text-muted-foreground">Loading multi-day permit workspace…</p>;
  }

  const canManage = ["active", "suspended"].includes(detail.permit.status);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Multi-day operations</h1>
            <PermitStatusBadge status={detail.permit.status} />
          </div>
          <p className="text-sm text-muted-foreground">{detail.permit.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/permits/${permitId}`}>
            <Button variant="outline">Permit details</Button>
          </Link>
          <Link href={`/execution/${permitId}`}>
            <Button variant="outline">Execution</Button>
          </Link>
        </div>
      </div>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Daily progress and revalidation are available for active or suspended permits only.
        </p>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <DailyProgressForm permitId={permitId} onSaved={load} />
            <HandoverForm permitId={permitId} progressRecords={progress} onSaved={load} />
          </div>

          <RevalidationWorkflow
            permitId={permitId}
            permitStatus={detail.permit.status}
            onUpdated={load}
          />
        </>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-lg font-medium">Daily progress history</h2>
          {progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">No daily progress entries yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {progress.map((record) => (
                <li key={record.id} className="rounded-md border border-border px-3 py-2">
                  <p className="font-medium">
                    {record.operationalDate} · {record.status}
                  </p>
                  <p className="text-muted-foreground">{record.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-lg font-medium">Shift handovers</h2>
          {handovers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No handovers recorded yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {handovers.map((handover) => (
                <li key={handover.id} className="rounded-md border border-border px-3 py-2">
                  <p className="font-medium">{new Date(handover.handedOverAt).toLocaleString()}</p>
                  <p className="text-muted-foreground">{handover.completedActivities}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-lg font-medium">Daily activity timeline</h2>
          <DailyActivityTimeline events={dailyHistory} />
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-lg font-medium">Revalidation history</h2>
          <RevalidationHistoryTimeline events={revalidationHistory} />
        </div>
      </section>
    </main>
  );
}
