"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  activatePermit,
  addProgress,
  getPermitExecution,
  resumePermit,
  suspendPermit,
  uploadExecutionEvidence,
} from "@/lib/execution/api";
import type { ExecutionDetail } from "@/lib/execution/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

export function ExecutionWorkspace({ permitId }: { permitId: string }) {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceComment, setEvidenceComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [readiness, setReadiness] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await getPermitExecution(permitId));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load execution");
    }
  }, [permitId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitProgress(event: FormEvent) {
    event.preventDefault();
    if (!summary.trim()) return;
    await run(() => addProgress(permitId, summary.trim()), "Progress update recorded.");
    setSummary("");
  }

  async function submitEvidence(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    await run(
      () => uploadExecutionEvidence(permitId, file, evidenceComment.trim()),
      "Evidence uploaded and permanently linked.",
    );
    setFile(null);
    setEvidenceComment("");
  }

  if (!detail && !error) {
    return <p className="text-sm text-muted-foreground">Loading execution workspace...</p>;
  }

  if (!detail) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const status = detail.permit.status;
  const canUpdate = status === "active";

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{detail.permit.title}</h1>
              <PermitStatusBadge status={status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {detail.permit.reference ?? "Unreferenced permit"} · execution control
            </p>
          </div>
          {status === "approved" ? (
            <div className="grid gap-3 rounded-lg border border-border p-4">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={readiness}
                  onChange={(event) => setReadiness(event.target.checked)}
                  className="mt-0.5 size-4"
                />
                I have reviewed the permit conditions and confirm the worksite is ready.
              </label>
              <Button
                disabled={!readiness || busy}
                onClick={() => run(() => activatePermit(permitId), "Permit activated.")}
              >
                <PlayCircle className="size-4" aria-hidden />
                Start work
              </Button>
            </div>
          ) : null}
        </div>

        {detail.execution ? (
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Actual start</dt>
              <dd className="font-medium">
                {new Date(detail.execution.activatedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Progress entries</dt>
              <dd className="font-medium">{detail.progress.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Evidence files</dt>
              <dd className="font-medium">{detail.evidence.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last transition</dt>
              <dd className="font-medium">
                {detail.history[0]
                  ? new Date(detail.history[0].changedAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : null}

        {status === "suspended" ? (
          <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 text-destructive" aria-hidden />
              <div>
                <p className="font-medium">Work suspended</p>
                <p className="text-sm text-muted-foreground">
                  {detail.execution?.suspensionReason ?? "No reason recorded."}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Resume authorisation note"
                className="min-w-64 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                disabled={busy}
                onClick={() =>
                  run(() => resumePermit(permitId, reason.trim()), "Work resumed.")
                }
              >
                <PlayCircle className="size-4" aria-hidden />
                Authorise resume
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {notice ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4" aria-hidden />
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Clock3 className="size-4" aria-hidden />
            Progress timeline
          </h2>
          {canUpdate ? (
            <form onSubmit={submitProgress} className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium">
                Work update
                <textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  maxLength={2000}
                  required
                  rows={4}
                  placeholder="Describe completed work, current conditions and next action."
                  className="rounded-md border border-input bg-background px-3 py-2 font-normal"
                />
              </label>
              <Button className="justify-self-start" disabled={busy || !summary.trim()}>
                Record progress
              </Button>
            </form>
          ) : null}
          <div className="mt-5 grid gap-3">
            {detail.progress.length === 0 ? (
              <p className="text-sm text-muted-foreground">No progress recorded.</p>
            ) : (
              detail.progress.map((entry) => (
                <article key={entry.id} className="rounded-lg border border-border p-4">
                  <p className="whitespace-pre-wrap text-sm">{entry.summary}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(entry.recordedAt).toLocaleString()}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        <div className="grid content-start gap-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Camera className="size-4" aria-hidden />
              Evidence
            </h2>
            {canUpdate ? (
              <form onSubmit={submitEvidence} className="mt-4 grid gap-3">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                  className="text-sm"
                />
                <input
                  value={evidenceComment}
                  onChange={(event) => setEvidenceComment(event.target.value)}
                  maxLength={1000}
                  placeholder="Optional evidence note"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button disabled={busy || !file}>Upload evidence</Button>
              </form>
            ) : null}
            <ul className="mt-4 grid gap-2 text-sm">
              {detail.evidence.length === 0 ? (
                <li className="text-muted-foreground">No evidence uploaded.</li>
              ) : (
                detail.evidence.map((item) => (
                  <li key={item.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{item.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(item.fileSize / 1024)} KB ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                    {item.comment ? <p className="mt-1 text-xs">{item.comment}</p> : null}
                  </li>
                ))
              )}
            </ul>
          </section>

          {canUpdate ? (
            <section className="rounded-xl border border-destructive/30 bg-card p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <PauseCircle className="size-4 text-destructive" aria-hidden />
                Suspend work
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Progress stops until an authorised supervisor resumes the permit.
              </p>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Mandatory suspension reason"
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                variant="destructive"
                className="mt-3"
                disabled={busy || reason.trim().length < 3}
                onClick={() =>
                  run(() => suspendPermit(permitId, reason.trim()), "Work suspended.")
                }
              >
                Confirm suspension
              </Button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
