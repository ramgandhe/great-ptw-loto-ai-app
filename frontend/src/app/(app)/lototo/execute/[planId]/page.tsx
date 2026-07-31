"use client";

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
import { IsolationChecklist } from "@/components/isolation-execution/isolation-checklist";
import { LockRegisterTable } from "@/components/isolation-execution/lock-register-table";
import { TagRegisterTable } from "@/components/isolation-execution/tag-register-table";
import { EvidenceUpload } from "@/components/execution/evidence-upload";
import { Button } from "@/components/ui/button";

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
      if (!selectedPointId && data.sequence[0]) {
        setSelectedPointId(data.sequence[0].isolationPointId);
      }
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
      setMessage(successMessage);
      await loadDetail();
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
      <main className="flex flex-1 flex-col gap-6 p-8">
        <Link href="/lototo/active" className="text-sm text-muted-foreground hover:text-foreground">
          ← Active LOTOTO
        </Link>
        <h1 className="text-2xl font-semibold">Isolation execution</h1>
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
  const canVerify =
    execution.status === "in_progress" || execution.status === "isolated";

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/lototo/active" className="text-sm text-muted-foreground hover:text-foreground">
          ← Active LOTOTO
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {detail.plan?.title ?? "Isolation execution"}
          </h1>
          <ExecutionStatusBadge status={execution.status} />
        </div>
        {detail.plan ? (
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/permits/${detail.plan.permitId}`} className="underline">
              View permit
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
          <h2 className="text-lg font-medium">Isolation checklist</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Follow the approved sequence. Locks and tags must be applied in order.
          </p>
          <IsolationChecklist
            sequence={detail.sequence}
            locks={detail.locks}
            tags={detail.tags}
            verifications={detail.verifications}
          />
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border p-4">
            <h2 className="text-lg font-medium">Apply lock</h2>
            <form className="mt-4 grid gap-3" onSubmit={handleApplyLock}>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Isolation point</span>
                <select
                  value={selectedPointId}
                  onChange={(event) => setSelectedPointId(event.target.value)}
                  disabled={!canApplyLocks || isSubmitting}
                  className="rounded-md border border-input bg-background px-3 py-2"
                >
                  {detail.sequence.map((step) => (
                    <option key={step.isolationPointId} value={step.isolationPointId}>
                      {step.sequenceOrder}. {step.isolationNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Lock tag</span>
                <input
                  value={lockTag}
                  onChange={(event) => setLockTag(event.target.value)}
                  disabled={!canApplyLocks || isSubmitting}
                  className="rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Lock method</span>
                <input
                  value={lockMethod}
                  onChange={(event) => setLockMethod(event.target.value)}
                  disabled={!canApplyLocks || isSubmitting}
                  className="rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <Button type="submit" disabled={!canApplyLocks || isSubmitting}>
                Apply lock
              </Button>
            </form>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h2 className="text-lg font-medium">Apply tag</h2>
            <form className="mt-4 grid gap-3" onSubmit={handleApplyTag}>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Tag number</span>
                <input
                  value={tagNumber}
                  onChange={(event) => setTagNumber(event.target.value)}
                  disabled={!canApplyLocks || isSubmitting}
                  className="rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Tag type</span>
                <input
                  value={tagType}
                  onChange={(event) => setTagType(event.target.value)}
                  disabled={!canApplyLocks || isSubmitting}
                  className="rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <Button type="submit" disabled={!canApplyLocks || isSubmitting}>
                Apply tag
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-medium">Lock register</h2>
          <div className="mt-4">
            <LockRegisterTable locks={detail.locks} pointLabels={pointLabels} />
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-medium">Tag register</h2>
          <div className="mt-4">
            <TagRegisterTable tags={detail.tags} pointLabels={pointLabels} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-medium">Verification</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Record verification for locked isolation points before authorising work.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Method</span>
            <input
              value={verifyMethod}
              onChange={(event) => setVerifyMethod(event.target.value)}
              disabled={!canVerify || isSubmitting}
              className="rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium">Comment (optional)</span>
            <textarea
              value={verifyComment}
              onChange={(event) => setVerifyComment(event.target.value)}
              disabled={!canVerify || isSubmitting}
              className="rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleVerifyPoint}
            disabled={!canVerify || isSubmitting}
          >
            Record pass verification
          </Button>
          {execution.status === "in_progress" ? (
            <Button onClick={handleMarkIsolated} disabled={isSubmitting}>
              Mark isolation complete
            </Button>
          ) : null}
          {execution.status === "isolated" ? (
            <Button onClick={handleMarkVerified} disabled={isSubmitting}>
              Complete verification
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-medium">Evidence</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Capture photos or documents as isolation evidence.
        </p>
        <EvidenceUpload
          disabled={isSubmitting}
          isUploading={isUploading}
          error={uploadError}
          onUpload={(file) => void handleEvidenceUpload(file)}
        />
        {detail.evidence.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {detail.evidence.map((item) => (
              <li key={item.id}>
                {item.fileName} · {new Date(item.capturedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {execution.status === "verified" ? (
        <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <h2 className="text-lg font-medium text-emerald-800 dark:text-emerald-300">
            Completion summary
          </h2>
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
            Isolation verified. {detail.locks.length} locks, {detail.tags.length} tags,{" "}
            {detail.verifications.length} verifications, {detail.evidence.length} evidence items.
          </p>
          {detail.plan ? (
            <Link href={`/execution/${detail.plan.permitId}`} className="mt-4 inline-block">
              <Button>Open permit execution</Button>
            </Link>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
