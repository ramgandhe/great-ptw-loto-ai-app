"use client";

import { BackLink } from "@/components/layout/page-header";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { RestorationTimeline } from "@/components/restoration/restoration-timeline";
import { Button } from "@/components/ui/button";
import { restorationProgress } from "@/lib/restoration/progress";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

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

  async function load(advance = false) {
    const [iso, rest, hist] = await Promise.all([
      getIsolationExecutionDetail(executionId),
      getRestoration(executionId),
      getExecutionHistory(executionId),
    ]);
    setExecutionDetail(iso);
    setRestoration(rest);
    setHistory(hist);
    // Start on the first point with something to do; move on only once a point's verification is recorded.
    if (advance || !selectedPointId) {
      setSelectedPointId(restorationProgress(iso.sequence, iso.locks, iso.tags, rest).current?.step.isolationPointId ?? "");
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

  async function runAction(action: () => Promise<void>, successMessage: string, advance = false) {
    setIsSubmitting(true);
    setActionError(null);
    setMessage(null);
    try {
      await action();
      await load(advance);
      setMessage(successMessage);
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
  const { points, current, outstanding } = restorationProgress(executionDetail.sequence, executionDetail.locks, executionDetail.tags, restoration);
  const selected = points.find((p) => p.step.isolationPointId === selectedPointId) ?? current;
  const confirmed = (question: string, run: () => Promise<unknown>, done: string, advance = false) => {
    if (window.confirm(question)) void runAction(async () => void (await run()), done, advance);
  };

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div>
        <BackLink href="/lototo?view=restoration" label="LOTOTO restoration" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-bold tracking-tight">{executionDetail.plan?.title ?? "Equipment restoration"}</h1>
          <ExecutionStatusBadge status={restoration.execution.status} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          <span>
            Still on: {outstanding.locks} lock{outstanding.locks === 1 ? "" : "s"}, {outstanding.tags} tag{outstanding.tags === 1 ? "" : "s"};{" "}
            {outstanding.points} of {points.length} points to restore
          </span>
          {executionDetail.plan ? (
            <Link href={`/lototo/history/${executionDetail.plan.id}`} className="text-primary hover:underline">
              LOTOTO history
            </Link>
          ) : null}
        </p>
        {!canRestore && restoration.execution.status !== "restored" ? (
          <p className="mt-2 text-sm text-(--status-warning)">Restoration starts once the isolation is verified.</p>
        ) : null}
      </div>

      {actionError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}
      {message ? (
        <p className="text-sm text-(--status-success)" role="status">
          {message}
        </p>
      ) : null}

      <nav aria-label="Isolation points" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex w-max gap-2">
          {points.map((p) => (
            <li key={p.step.isolationPointId}>
              <button
                type="button"
                aria-current={p === selected ? "step" : undefined}
                onClick={() => setSelectedPointId(p.step.isolationPointId)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm",
                  p === selected ? "border-primary bg-primary/10 font-semibold" : "border-border bg-card hover:bg-muted",
                )}
              >
                {p.done ? <CheckCircle2 className="size-4 text-(--status-success)" aria-label="Done" /> : <Circle className="size-4 text-muted-foreground" aria-hidden />}
                {p.step.sequenceOrder}. {p.step.isolationNumber}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {selected ? (
        <section aria-labelledby="point-heading" className="grid gap-5 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 id="point-heading" className="text-lg font-semibold">
              Point {selected.step.sequenceOrder}: {selected.step.isolationNumber}
            </h2>
            {selected.step.description ? <p className="text-sm text-muted-foreground">{selected.step.description}</p> : null}
          </div>

          {/* Each removal, the restoration and its verification is its own confirmed step. */}
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">1. Remove locks and tags</h3>
            {selected.locks.length + selected.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing left on this point.</p>
            ) : (
              <ul className="grid gap-2">
                {selected.locks.map((lock) => (
                  <li key={lock.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>Lock {lock.lockTag}</span>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={!canRestore || isSubmitting}
                      onClick={() => confirmed(`Remove lock ${lock.lockTag}?`, () => removeLock(executionId, lock.id, removalReason.trim() || undefined), "Lock removed")}
                    >
                      Remove lock
                    </Button>
                  </li>
                ))}
                {selected.tags.map((tag) => (
                  <li key={tag.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>Tag {tag.tagNumber}</span>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={!canRestore || isSubmitting}
                      onClick={() => confirmed(`Remove tag ${tag.tagNumber}?`, () => removeTag(executionId, tag.id, removalReason.trim() || undefined), "Tag removed")}
                    >
                      Remove tag
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {selected.locks.length + selected.tags.length > 0 ? (
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Removal reason (optional)</span>
                <input value={removalReason} onChange={(e) => setRemovalReason(e.target.value)} className={FIELD} />
              </label>
            ) : null}
          </div>

          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">2. Restore and verify</h3>
            {selected.restored ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-(--status-success)" aria-hidden />
                Restored {formatDateTime(selected.restored.restoredAt)}
                {selected.restored.method ? ` · ${selected.restored.method}` : ""}
              </p>
            ) : (
              <label className="grid gap-1 text-sm md:max-w-sm">
                <span className="font-medium">Method</span>
                <input value={restoreMethod} onChange={(e) => setRestoreMethod(e.target.value)} disabled={!canRestore || isSubmitting} className={FIELD} />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {selected.restored ? null : (
                <Button
                  className="min-h-11"
                  disabled={!canRestore || isSubmitting}
                  onClick={() =>
                    confirmed(
                      `Restore ${selected.step.isolationNumber}?${selected.locks.length + selected.tags.length ? " Locks or tags are still on this point." : ""}`,
                      () => restoreEquipment(executionId, { isolationPointId: selected.step.isolationPointId, method: restoreMethod.trim() || undefined }),
                      "Equipment restored",
                    )
                  }
                >
                  Restore point
                </Button>
              )}
              <Button
                variant="outline"
                className="min-h-11"
                disabled={(!canRestore && restoration.execution.status !== "restored") || isSubmitting}
                onClick={() =>
                  confirmed(
                    "Record a passing restoration verification?",
                    () => recordRestorationVerification(executionId, { isolationPointId: selected.step.isolationPointId, result: "pass", method: restoreMethod.trim() || undefined }),
                    "Restoration verified",
                    true,
                  )
                }
              >
                Record verification
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {canRestore ? (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-5">
          <p className="flex-1 text-sm text-muted-foreground">When every point is restored, complete the restoration.</p>
          <Button
            className="min-h-11"
            disabled={isSubmitting || outstanding.points > 0}
            onClick={() => confirmed("Complete restoration for all points?", () => completeRestoration(executionId), "Restoration complete")}
          >
            Complete restoration
          </Button>
        </section>
      ) : null}

      {restoration.execution.status === "restored" ? (
        <section className="rounded-xl border border-(--status-success) bg-(--status-success-bg) p-5 text-sm">
          <h2 className="font-semibold">Restoration complete</h2>
          <p className="mt-1">
            {restoration.restorations.length} points restored · {restoration.lockRemovals.length} locks removed · {restoration.tagRemovals.length} tags removed
          </p>
        </section>
      ) : null}

      <details className="rounded-xl border border-border bg-card px-5 py-3">
        <summary className="cursor-pointer text-sm font-semibold">LOTOTO register and history ({history.length})</summary>
        <div className="mt-3">
          <RestorationTimeline entries={history} />
        </div>
      </details>
    </main>
  );
}

const FIELD = "h-11 rounded-lg border border-input bg-background px-3 disabled:opacity-60";
