"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getIsolationExecutionDetail } from "@/lib/isolation-execution/api";
import type { IsolationExecutionDetail } from "@/lib/isolation-execution/types";
import {
  completeRestoration,
  getExecutionHistory,
  getRestoration,
  recordRestorationVerification,
  removeLock,
  removeTag,
  restoreEquipment,
} from "@/lib/restoration/api";
import type { RestorationDetail } from "@/lib/restoration/types";
import { ExecutionStatusBadge } from "@/components/isolation-execution/execution-status-badge";
import { RestorationChecklist } from "@/components/restoration/restoration-checklist";
import { RestorationTimeline } from "@/components/restoration/restoration-timeline";
import { Button } from "@/components/ui/button";

export default function RestorationWorkspacePage() {
  const params = useParams<{ executionId: string }>();
  const executionId = params.executionId;

  const [executionDetail, setExecutionDetail] = useState<IsolationExecutionDetail | null>(null);
  const [restoration, setRestoration] = useState<RestorationDetail | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getExecutionHistory>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedPointId, setSelectedPointId] = useState("");
  const [restoreMethod, setRestoreMethod] = useState("re-energise");
  const [removalReason, setRemovalReason] = useState("");

  const pointLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const step of executionDetail?.sequence ?? []) {
      labels[step.isolationPointId] = step.isolationNumber;
    }
    return labels;
  }, [executionDetail?.sequence]);

  const removedLockIds = useMemo(
    () => new Set(restoration?.lockRemovals.map((item) => item.appliedLockId) ?? []),
    [restoration?.lockRemovals],
  );
  const removedTagIds = useMemo(
    () => new Set(restoration?.tagRemovals.map((item) => item.appliedTagId) ?? []),
    [restoration?.tagRemovals],
  );

  async function load() {
    const [iso, rest, hist] = await Promise.all([
      getIsolationExecutionDetail(executionId),
      getRestoration(executionId),
      getExecutionHistory(executionId),
    ]);
    setExecutionDetail(iso);
    setRestoration(rest);
    setHistory(hist);
    if (!selectedPointId && iso.sequence[0]) {
      setSelectedPointId(iso.sequence[0].isolationPointId);
    }
  }

  useEffect(() => {
    setIsLoading(true);
    load()
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load restoration");
      })
      .finally(() => setIsLoading(false));
  }, [executionId]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setIsSubmitting(true);
    setActionError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading restoration…</p>;
  }

  if (error || !executionDetail || !restoration) {
    return (
      <div className="p-8 text-sm text-destructive" role="alert">
        {error ?? "Restoration not found"}
      </div>
    );
  }

  const canRestore = restoration.execution.status === "verified";
  const activeLocks = executionDetail.locks.filter(
    (lock) => lock.status === "applied" && !removedLockIds.has(lock.id),
  );
  const activeTags = executionDetail.tags.filter(
    (tag) => tag.status === "applied" && !removedTagIds.has(tag.id),
  );

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/lototo/restoration" className="text-sm text-muted-foreground hover:text-foreground">
          ← Restoration queue
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {executionDetail.plan?.title ?? "Equipment restoration"}
          </h1>
          <ExecutionStatusBadge status={restoration.execution.status} />
        </div>
        {executionDetail.plan ? (
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/lototo/history/${executionDetail.plan.id}`} className="underline">
              View LOTOTO history
            </Link>
          </p>
        ) : null}
      </div>

      {actionError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {message}
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-medium">Restoration checklist</h2>
          <div className="mt-4">
            <RestorationChecklist
              sequence={executionDetail.sequence}
              restorations={restoration.restorations}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border p-4">
            <h2 className="text-lg font-medium">Remove locks</h2>
            {activeLocks.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">All locks removed.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {activeLocks.map((lock) => (
                  <li key={lock.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {pointLabels[lock.isolationPointId] ?? lock.isolationPointId.slice(0, 8)} ·{" "}
                      {lock.lockTag}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canRestore || isSubmitting}
                      onClick={() =>
                        void runAction(async () => {
                          await removeLock(executionId, lock.id, removalReason.trim() || undefined);
                        }, "Lock removed")
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border p-4">
            <h2 className="text-lg font-medium">Remove tags</h2>
            {activeTags.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">All tags removed.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {activeTags.map((tag) => (
                  <li key={tag.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {pointLabels[tag.isolationPointId] ?? tag.isolationPointId.slice(0, 8)} ·{" "}
                      {tag.tagNumber}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canRestore || isSubmitting}
                      onClick={() =>
                        void runAction(async () => {
                          await removeTag(executionId, tag.id, removalReason.trim() || undefined);
                        }, "Tag removed")
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-3 grid gap-1 text-sm">
              <span className="font-medium">Removal reason (optional)</span>
              <input
                value={removalReason}
                onChange={(event) => setRemovalReason(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-medium">Restore equipment</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Isolation point</span>
            <select
              value={selectedPointId}
              onChange={(event) => setSelectedPointId(event.target.value)}
              disabled={!canRestore || isSubmitting}
              className="rounded-md border border-input bg-background px-3 py-2"
            >
              {executionDetail.sequence.map((step) => (
                <option key={step.isolationPointId} value={step.isolationPointId}>
                  {step.sequenceOrder}. {step.isolationNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Method</span>
            <input
              value={restoreMethod}
              onChange={(event) => setRestoreMethod(event.target.value)}
              disabled={!canRestore || isSubmitting}
              className="rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={!canRestore || isSubmitting || !selectedPointId}
            onClick={() =>
              void runAction(async () => {
                await restoreEquipment(executionId, {
                  isolationPointId: selectedPointId,
                  method: restoreMethod.trim() || undefined,
                });
              }, "Equipment restored")
            }
          >
            Restore point
          </Button>
          <Button
            variant="outline"
            disabled={!canRestore || isSubmitting || !selectedPointId}
            onClick={() => {
              const confirmed = window.confirm("Record a passing restoration verification?");
              if (!confirmed) {
                return;
              }
              void runAction(async () => {
                await recordRestorationVerification(executionId, {
                  isolationPointId: selectedPointId,
                  result: "pass",
                  method: restoreMethod.trim() || undefined,
                });
              }, "Restoration verified");
            }}
          >
            Record verification
          </Button>
          {canRestore ? (
            <Button
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                const confirmed = window.confirm(
                  "Complete restoration for all points? Equipment must be restored first.",
                );
                if (!confirmed) {
                  return;
                }
                void runAction(async () => {
                  await completeRestoration(executionId);
                }, "Restoration complete");
              }}
            >
              Complete restoration
            </Button>
          ) : null}
        </div>
      </section>

      {restoration.execution.status === "restored" ? (
        <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <h2 className="text-lg font-medium text-emerald-800 dark:text-emerald-300">
            Restoration summary
          </h2>
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
            {restoration.restorations.length} points restored · {restoration.lockRemovals.length}{" "}
            locks removed · {restoration.tagRemovals.length} tags removed
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-medium">LOTOTO history</h2>
        <div className="mt-4">
          <RestorationTimeline entries={history} />
        </div>
      </section>
    </main>
  );
}
