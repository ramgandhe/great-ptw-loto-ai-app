"use client";

import { BackLink } from "@/components/layout/page-header";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  applyLock,
  applyTag,
  getIsolationExecutionForPlan,
  markIsolationComplete,
  markIsolationVerified,
  recordVerification,
  startIsolationExecution,
  uploadIsolationEvidence,
} from "@/lib/isolation-execution/api";
import type { IsolationExecutionDetail } from "@/lib/isolation-execution/types";
import { ExecutionStatusBadge } from "@/components/isolation-execution/execution-status-badge";
import { LockRegisterTable } from "@/components/isolation-execution/lock-register-table";
import { TagRegisterTable } from "@/components/isolation-execution/tag-register-table";
import { EvidenceUpload } from "@/components/execution/evidence-upload";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { isolationProgress } from "@/lib/isolation-execution/progress";
import { workspaceHref } from "@/lib/permit/workspace-tabs";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Lock } from "lucide-react";

export default function IsolationExecutionPage() {
  const params = useParams<{ planId: string }>();
  const planId = params.planId;

  const [detail, setDetail] = useState<IsolationExecutionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [selectedPointId, setSelectedPointId] = useState("");
  const [lockTag, setLockTag] = useState("");
  const [lockMethod, setLockMethod] = useState("padlock");
  const [tagNumber, setTagNumber] = useState("");
  const [tagType, setTagType] = useState("danger");
  const [verifyMethod, setVerifyMethod] = useState("try-out");
  const [verifyComment, setVerifyComment] = useState("");

  const pointLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const step of detail?.sequence ?? []) {
      labels[step.isolationPointId] = step.isolationNumber;
    }
    return labels;
  }, [detail?.sequence]);

  async function loadDetail() {
    try {
      const data = await getIsolationExecutionForPlan(planId);
      setDetail(data);
      // After each action, move on to the first point still to finish.
      const next = isolationProgress(data.sequence, data.locks, data.tags, data.verifications).current;
      setSelectedPointId(next?.step.isolationPointId ?? "");
    } catch (err) {
      if (err instanceof ApiError && err.message.includes("not found")) {
        setDetail(null);
        return;
      }
      throw err;
    }
  }

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    loadDetail()
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load isolation execution");
      })
      .finally(() => setIsLoading(false));
  }, [planId]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setIsSubmitting(true);
    setActionError(null);
    setMessage(null);
    try {
      await action();
      await loadDetail();
      setMessage(successMessage);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStart() {
    await runAction(async () => {
      await startIsolationExecution(planId);
      await loadDetail();
    }, "Isolation execution started.");
  }

  async function handleApplyLock(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !selectedPointId || !lockTag.trim()) {
      setActionError("Isolation point and lock tag are required.");
      return;
    }

    await runAction(async () => {
      await applyLock(detail.execution.id, {
        isolationPointId: selectedPointId,
        lockTag: lockTag.trim(),
        lockMethod: lockMethod.trim(),
      });
      setLockTag("");
    }, "Lock applied.");
  }

  async function handleApplyTag(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !selectedPointId || !tagNumber.trim()) {
      setActionError("Isolation point and tag number are required.");
      return;
    }

    await runAction(async () => {
      await applyTag(detail.execution.id, {
        isolationPointId: selectedPointId,
        tagNumber: tagNumber.trim(),
        tagType: tagType.trim(),
      });
      setTagNumber("");
    }, "Tag applied.");
  }

  async function handleVerifyPoint() {
    if (!detail || !selectedPointId) {
      return;
    }

    const confirmed = window.confirm(
      "Record a passing verification for this isolation point? This cannot be undone without supervisor review.",
    );
    if (!confirmed) {
      return;
    }

    await runAction(async () => {
      await recordVerification(detail.execution.id, {
        isolationPointId: selectedPointId,
        result: "pass",
        method: verifyMethod.trim() || undefined,
        comment: verifyComment.trim() || undefined,
      });
      setVerifyComment("");
    }, "Verification recorded.");
  }

  async function handleMarkIsolated() {
    if (!detail) {
      return;
    }

    const confirmed = window.confirm(
      "Confirm all isolation points are locked and isolation is complete?",
    );
    if (!confirmed) {
      return;
    }

    await runAction(async () => {
      await markIsolationComplete(detail.execution.id);
    }, "Isolation marked complete.");
  }

  async function handleMarkVerified() {
    if (!detail) {
      return;
    }

    const confirmed = window.confirm(
      "Confirm all required verifications passed and work may commence?",
    );
    if (!confirmed) {
      return;
    }

    await runAction(async () => {
      await markIsolationVerified(detail.execution.id);
    }, "Isolation verified — permit execution may proceed.");
  }

  async function handleEvidenceUpload(file: File) {
    if (!detail) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadIsolationEvidence(detail.execution.id, file, {
        isolationPointId: selectedPointId || undefined,
      });
      setMessage("Evidence captured.");
      await loadDetail();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Evidence upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  if (isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Loading isolation execution…</p>;
  }

  if (error) {
    return (
      <div className="p-8 text-sm text-destructive" role="alert">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
        <BackLink href="/lototo?view=active" label="LOTOTO" />
        <h1 className="font-heading text-3xl font-bold tracking-tight">Isolation execution</h1>
        <p className="text-sm text-muted-foreground">
          No isolation execution has been started for this plan.
        </p>
        {actionError ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}
        <Button onClick={handleStart} disabled={isSubmitting}>
          {isSubmitting ? "Starting…" : "Start isolation execution"}
        </Button>
      </main>
    );
  }

  const execution = detail.execution;
  const canApplyLocks = execution.status === "in_progress";
  const canVerify = execution.status === "in_progress" || execution.status === "isolated";
  const { points, current, left } = isolationProgress(detail.sequence, detail.locks, detail.tags, detail.verifications);
  const selected = points.find((p) => p.step.isolationPointId === selectedPointId) ?? current;
  const finished = points.filter((p) => p.done && p !== selected);
  const pointEvidence = detail.evidence.filter((e) => e.isolationPointId === selected?.step.isolationPointId);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div>
        <BackLink href="/lototo?view=active" label="LOTOTO" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-bold tracking-tight">{detail.plan?.title ?? "Isolation execution"}</h1>
          <ExecutionStatusBadge status={execution.status} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          <span>
            {points.length === 0 ? "No isolation sequence configured for this plan." : left === 0 ? `All ${points.length} points done` : `${left} of ${points.length} points to do`}
          </span>
          {detail.plan?.permitId ? (
            <Link href={workspaceHref(detail.plan.permitId, "work")} className="text-primary hover:underline">
              Permit
            </Link>
          ) : null}
        </p>
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

      {/* Points in the approved order. A point opens once every earlier point is locked. */}
      <nav aria-label="Isolation points" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex w-max gap-2">
          {points.map((p) => (
            <li key={p.step.isolationPointId}>
              <button
                type="button"
                aria-current={p === selected ? "step" : undefined}
                disabled={!p.open && !p.done}
                title={!p.open && !p.done ? "Lock the earlier points first" : undefined}
                onClick={() => setSelectedPointId(p.step.isolationPointId)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm disabled:opacity-50",
                  p === selected ? "border-primary bg-primary/10 font-semibold" : "border-border bg-card hover:bg-muted",
                )}
              >
                {p.done ? (
                  <CheckCircle2 className="size-4 text-(--status-success)" aria-label="Done" />
                ) : p.open ? (
                  <Circle className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <Lock className="size-4 text-muted-foreground" aria-label="Waiting for earlier points" />
                )}
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

          <div className="grid gap-5 lg:grid-cols-2">
            {selected.lock ? (
              <PointRecord label="Lock" detail={`${selected.lock.lockTag} · ${selected.lock.lockMethod} · ${formatDateTime(selected.lock.appliedAt)}`} />
            ) : (
              <form className="grid gap-3" onSubmit={handleApplyLock}>
                <h3 className="text-sm font-semibold">Lock</h3>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Lock tag</span>
                  <input value={lockTag} onChange={(e) => setLockTag(e.target.value)} disabled={!canApplyLocks || !selected.open || isSubmitting} className={FIELD} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Lock method</span>
                  <input value={lockMethod} onChange={(e) => setLockMethod(e.target.value)} disabled={!canApplyLocks || !selected.open || isSubmitting} className={FIELD} />
                </label>
                <Button type="submit" className="min-h-11" disabled={!canApplyLocks || !selected.open || isSubmitting}>
                  Apply lock
                </Button>
              </form>
            )}

            {selected.tag ? (
              <PointRecord label="Tag" detail={`${selected.tag.tagNumber} · ${selected.tag.tagType} · ${formatDateTime(selected.tag.appliedAt)}`} />
            ) : (
              <form className="grid gap-3" onSubmit={handleApplyTag}>
                <h3 className="text-sm font-semibold">Tag</h3>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Tag number</span>
                  <input value={tagNumber} onChange={(e) => setTagNumber(e.target.value)} disabled={!canApplyLocks || isSubmitting} className={FIELD} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Tag type</span>
                  <input value={tagType} onChange={(e) => setTagType(e.target.value)} disabled={!canApplyLocks || isSubmitting} className={FIELD} />
                </label>
                <Button type="submit" className="min-h-11" disabled={!canApplyLocks || isSubmitting}>
                  Apply tag
                </Button>
              </form>
            )}
          </div>

          {selected.step.requiresVerification ? (
            selected.verification ? (
              <PointRecord
                label="Verified"
                detail={`${selected.verification.method ?? "Pass"} · ${formatDateTime(selected.verification.verifiedAt)}${selected.verification.comment ? ` · ${selected.verification.comment}` : ""}`}
              />
            ) : (
              <div className="grid gap-3">
                <h3 className="text-sm font-semibold">Verify isolation</h3>
                {selected.lock ? null : <p className="text-sm text-muted-foreground">Lock this point before verifying it.</p>}
                <div className="grid gap-3 md:grid-cols-[14rem_1fr]">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Method</span>
                    <input value={verifyMethod} onChange={(e) => setVerifyMethod(e.target.value)} disabled={!canVerify || !selected.lock || isSubmitting} className={FIELD} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Comment (optional)</span>
                    <input value={verifyComment} onChange={(e) => setVerifyComment(e.target.value)} disabled={!canVerify || !selected.lock || isSubmitting} className={FIELD} />
                  </label>
                </div>
                <Button variant="outline" className="min-h-11 justify-self-start" onClick={handleVerifyPoint} disabled={!canVerify || !selected.lock || isSubmitting}>
                  Record pass verification
                </Button>
              </div>
            )
          ) : null}

          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">Evidence for this point</h3>
            <EvidenceUpload disabled={isSubmitting} isUploading={isUploading} error={uploadError} onUpload={(file) => void handleEvidenceUpload(file)} />
            {pointEvidence.length > 0 ? (
              <ul className="grid gap-1 text-sm">
                {pointEvidence.map((item) => (
                  <li key={item.id}>
                    {item.fileName} · {formatDateTime(item.capturedAt)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Isolation as a whole: two separate confirmed steps, never done for the person. */}
      {execution.status === "in_progress" || execution.status === "isolated" ? (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-5">
          <p className="flex-1 text-sm text-muted-foreground">
            {execution.status === "in_progress"
              ? "When every point is locked, mark the isolation complete."
              : "When every point that needs it is verified, complete the verification so work can start."}
          </p>
          {execution.status === "in_progress" ? (
            <Button className="min-h-11" onClick={handleMarkIsolated} disabled={isSubmitting || points.some((p) => !p.lock)}>
              Mark isolation complete
            </Button>
          ) : (
            <Button className="min-h-11" onClick={handleMarkVerified} disabled={isSubmitting}>
              Complete verification
            </Button>
          )}
        </section>
      ) : null}

      {finished.length > 0 ? (
        <section aria-labelledby="done-heading" className="grid gap-2">
          <h2 id="done-heading" className="text-sm font-semibold">
            Finished points ({finished.length})
          </h2>
          {finished.map((p) => (
            <details key={p.step.isolationPointId} className="rounded-lg border border-border bg-card px-4 py-2 text-sm">
              <summary className="cursor-pointer py-1 font-medium">
                {p.step.sequenceOrder}. {p.step.isolationNumber}
              </summary>
              <dl className="grid gap-1 pb-2 sm:grid-cols-[6rem_1fr]">
                <dt className="text-muted-foreground">Lock</dt>
                <dd>{p.lock ? `${p.lock.lockTag} · ${p.lock.lockMethod} · ${formatDateTime(p.lock.appliedAt)}` : "—"}</dd>
                <dt className="text-muted-foreground">Tag</dt>
                <dd>{p.tag ? `${p.tag.tagNumber} · ${p.tag.tagType} · ${formatDateTime(p.tag.appliedAt)}` : "—"}</dd>
                {p.step.requiresVerification ? (
                  <>
                    <dt className="text-muted-foreground">Verified</dt>
                    <dd>{p.verification ? `${p.verification.method ?? "Pass"} · ${formatDateTime(p.verification.verifiedAt)}` : "—"}</dd>
                  </>
                ) : null}
              </dl>
            </details>
          ))}
        </section>
      ) : null}

      <details className="rounded-xl border border-border bg-card px-5 py-3">
        <summary className="cursor-pointer text-sm font-semibold">Lock and tag registers</summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <LockRegisterTable locks={detail.locks} pointLabels={pointLabels} />
          <TagRegisterTable tags={detail.tags} pointLabels={pointLabels} />
        </div>
      </details>

      {execution.status === "verified" ? (
        <section className="rounded-xl border border-(--status-success) bg-(--status-success-bg) p-5">
          <h2 className="font-semibold">Isolation verified</h2>
          <p className="mt-1 text-sm">
            {detail.locks.length} locks, {detail.tags.length} tags, {detail.verifications.length} verifications, {detail.evidence.length} evidence items.
          </p>
          {detail.plan?.permitId ? (
            <Link href={workspaceHref(detail.plan.permitId, "work")} className={cn(buttonVariants(), "mt-3")}>
              Open permit work
            </Link>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

const FIELD = "h-11 rounded-lg border border-input bg-background px-3 disabled:opacity-60";

function PointRecord({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="grid content-start gap-1">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <CheckCircle2 className="size-4 text-(--status-success)" aria-hidden />
        {label}
      </h3>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
