"use client";

import { BackLink } from "@/components/layout/page-header";
import Link from "next/link";
import { formatWindow } from "@/lib/format";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PermitPageShell, useInPermitWorkspace, usePermitPageId } from "@/lib/permit/workspace";
import { ApiError } from "@/lib/api";
import {
  activatePermit,
  addProgress,
  completeExecution,
  listEvidence,
  listProgress,
  revalidatePermitAfterSuspension,
  suspendPermit,
  uploadEvidence,
} from "@/lib/execution/api";
import type { EvidenceRecord, PermitExecution, ProgressRecord } from "@/lib/execution/types";
import { getPermit } from "@/lib/permit/api";
import { permitDetailToForm } from "@/lib/permit/form";
import type { PermitDetail } from "@/lib/permit/types";
import { ActivityLog } from "@/components/execution/activity-log";
import { EvidenceUpload } from "@/components/execution/evidence-upload";
import { ProgressFeed } from "@/components/execution/progress-feed";
import { StatusTimeline } from "@/components/execution/status-timeline";
import { SuspensionDialog } from "@/components/execution/suspension-dialog";
import { PermitSummary } from "@/components/permit/permit-summary";
import { PermitFormResponses } from "@/components/permit/permit-form-responses";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";

const SUSPEND_ROLES = ["tenant-owner", "tenant-admin", "hod", "safety-officer"] as const;
const REVALIDATE_ROLES = ["tenant-owner", "tenant-admin", "hod", "job-issuer"] as const;

/** Common site updates, so logging progress on a phone needs little typing. */
const PROGRESS_PHRASES = [
  "Work started",
  "Isolations verified before start",
  "Work progressing as planned",
  "Paused for shift handover",
  "Area cleaned and tools removed",
];

export default function PermitExecutionPage() {
  const permitId = usePermitPageId("permitId");
  const embedded = useInPermitWorkspace();
  const router = useRouter();
  const { roles } = useAuthProfile();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [execution, setExecution] = useState<PermitExecution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [progressSummary, setProgressSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [completeComment, setCompleteComment] = useState("");
  const [completeChecklist, setCompleteChecklist] = useState({
    workDescribedComplete: false,
    procedureFollowed: false,
    lototoDone: false,
    gasTestingDone: false,
  });

  async function loadData() {
    const permitDetail = await getPermit(permitId);
    setDetail(permitDetail);

    if (permitDetail.permit.status === "active" || permitDetail.permit.status === "suspended") {
      const [progressItems, evidenceItems] = await Promise.all([
        listProgress(permitId),
        listEvidence(permitId),
      ]);
      setProgress(progressItems);
      setEvidence(evidenceItems);
    }
  }

  useEffect(() => {
    loadData().catch((err) => {
      setError(err instanceof ApiError ? err.message : "Failed to load permit");
    });
  }, [permitId]);

  async function handleActivate() {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await activatePermit(permitId);
      setDetail((current) =>
        current ? { ...current, permit: result.permit } : current,
      );
      setExecution(result.execution);
      await loadData();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Activation failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevalidate() {
    const confirmed = window.confirm(
      "Revalidate this suspended permit? It will go through full approval again.",
    );
    if (!confirmed) {
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      await revalidatePermitAfterSuspension(permitId);
      router.push(`/approvals/${permitId}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Revalidation failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSuspend() {
    setIsSubmitting(true);
    setSuspendError(null);
    try {
      const result = await suspendPermit(permitId, suspendReason);
      setDetail((current) =>
        current ? { ...current, permit: result.permit } : current,
      );
      setExecution(result.execution);
      setSuspendOpen(false);
      setSuspendReason("");
      await loadData();
    } catch (err) {
      setSuspendError(err instanceof ApiError ? err.message : "Suspension failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteExecution() {
    if (!completeComment.trim() || !Object.values(completeChecklist).every(Boolean)) {
      setActionError("Complete the checklist and add a comment before declaring execution complete.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await completeExecution(permitId, {
        comment: completeComment.trim(),
        checklist: completeChecklist,
      });
      setDetail(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not complete execution");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddProgress(event: React.FormEvent) {
    event.preventDefault();
    if (!progressSummary.trim()) {
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const record = await addProgress(permitId, { summary: progressSummary.trim() });
      setProgress((items) => [...items, record]);
      setProgressSummary("");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to record progress");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUploadEvidence(file: File, comment: string) {
    setIsUploading(true);
    setUploadError(null);
    try {
      const record = await uploadEvidence(permitId, file, {
        comment: comment.trim() || undefined,
      });
      setEvidence((items) => [...items, record]);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  if (error) {
    return (
      <div className="p-8 text-sm text-destructive" role="alert">
        {error}
      </div>
    );
  }

  if (!detail) {
    return <p className="p-8 text-sm text-muted-foreground">Loading permit execution...</p>;
  }

  const { permit } = detail;
  const form = permitDetailToForm(detail);
  const isApproved = permit.status === "approved";
  const isActive = permit.status === "active";
  const isSuspended = permit.status === "suspended";

  return (
    <PermitPageShell>
      {embedded ? null : (
      <div>
        <BackLink href="/permits" label="Permits" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{permit.title}</h1>
          <PermitStatusBadge status={permit.status} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {permit.reference ? <span className="font-mono">{permit.reference}</span> : null}
          <span>{formatWindow(permit.plannedStartAt, permit.plannedEndAt)}</span>
        </p>
        <nav aria-label="Execution records" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href={`/permits/${permit.id}`} className="text-primary hover:underline">Permit</Link>
          <Link href={`/execution/${permit.id}/progress`} className="text-primary hover:underline">Progress timeline</Link>
          <Link href={`/execution/${permit.id}/evidence`} className="text-primary hover:underline">Evidence photos</Link>
          {isActive || isSuspended ? (
            <Link href={`/permits/${permit.id}/multi-day`} className="text-primary hover:underline">Daily progress</Link>
          ) : null}
        </nav>
      </div>
      )}

      {actionError ? (
        <div role="alert" className="text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      <section className="flex flex-wrap gap-2">
        {isApproved ? (
          <Button onClick={handleActivate} disabled={isSubmitting}>
            {isSubmitting ? "Starting..." : "Start work"}
          </Button>
        ) : null}
        {isApproved || isActive ? (
          hasAnyRole(roles, SUSPEND_ROLES) ? (
            <Button variant="destructive" onClick={() => setSuspendOpen(true)} disabled={isSubmitting}>
              Suspend work
            </Button>
          ) : null
        ) : null}
        {isSuspended && hasAnyRole(roles, REVALIDATE_ROLES) ? (
          <Button onClick={() => void handleRevalidate()} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Revalidate after suspension"}
          </Button>
        ) : null}
      </section>


      {(isActive || isSuspended) && (
        <>
          <section className="grid gap-3">
            <h2 className="text-sm font-semibold">Execution timeline</h2>
            <StatusTimeline execution={execution} />
          </section>

          {isActive ? (
            <>
              <section className="grid gap-3">
                <h2 className="text-sm font-semibold">Add progress update</h2>
                <form className="grid gap-3 rounded-lg border border-border p-4" onSubmit={handleAddProgress}>
                  <div className="flex flex-wrap gap-1.5">
                    {PROGRESS_PHRASES.map((phrase) => (
                      <button
                        key={phrase}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setProgressSummary((c) => (c.trim() ? `${c.trim()}. ${phrase}` : phrase))}
                        className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
                      >
                        {phrase}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={progressSummary}
                    required
                    disabled={isSubmitting}
                    onChange={(event) => setProgressSummary(event.target.value)}
                    placeholder="Describe work completed or current status..."
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button type="submit" disabled={isSubmitting || !progressSummary.trim()}>
                    {isSubmitting ? "Saving..." : "Save progress"}
                  </Button>
                </form>
              </section>

              <section className="grid gap-3">
                <h2 className="text-sm font-semibold">Upload evidence</h2>
                <EvidenceUpload
                  disabled={!isActive}
                  isUploading={isUploading}
                  error={uploadError}
                  onUpload={handleUploadEvidence}
                />
              </section>

              {hasAnyRole(roles, ["operator", "tenant-owner", "tenant-admin", "platform-admin"]) ? (
                <section className="grid gap-3 rounded-lg border border-border p-4">
                  <h2 className="text-sm font-semibold">Declare execution completed</h2>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={completeChecklist.workDescribedComplete}
                      onChange={(e) => setCompleteChecklist((current) => ({ ...current, workDescribedComplete: e.target.checked }))}
                    />
                    Work described in the permit is complete
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={completeChecklist.procedureFollowed}
                      onChange={(e) => setCompleteChecklist((current) => ({ ...current, procedureFollowed: e.target.checked }))}
                    />
                    Procedure was followed
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={completeChecklist.lototoDone}
                      onChange={(e) => setCompleteChecklist((current) => ({ ...current, lototoDone: e.target.checked }))}
                    />
                    LOTOTO is done
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={completeChecklist.gasTestingDone}
                      onChange={(e) => setCompleteChecklist((current) => ({ ...current, gasTestingDone: e.target.checked }))}
                    />
                    Gas testing is done
                  </label>
                  <textarea
                    value={completeComment}
                    required
                    disabled={isSubmitting}
                    onChange={(event) => setCompleteComment(event.target.value)}
                    placeholder="Completion comments (required)"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <Button onClick={() => void handleCompleteExecution()} disabled={isSubmitting || !completeComment.trim()}>
                    {isSubmitting ? "Submitting..." : "Mark execution completed"}
                  </Button>
                </section>
              ) : null}
            </>
          ) : null}

          <section className="grid gap-3">
            <h2 className="text-sm font-semibold">Recent progress</h2>
            <ProgressFeed items={progress.slice().reverse().slice(0, 5)} />
          </section>

          <section className="grid gap-3">
            <h2 className="text-sm font-semibold">Activity log</h2>
            <ActivityLog execution={execution} progress={progress} evidence={evidence} />
          </section>
        </>
      )}

      {/* Once work is under way the crew knows the permit; keep it one tap away instead of in the way. */}
      {/* In the workspace the Preparation tab has the permit, so it starts closed there. */}
      <details open={isApproved && !embedded} className="group rounded-xl border border-border bg-card open:border-transparent open:bg-transparent">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold group-open:px-0 group-open:pb-3">
          Permit details <span className="font-normal text-muted-foreground group-open:hidden">(tap to open)</span>
        </summary>
        <div className="grid gap-4">
          <PermitSummary form={form} status={permit.status} showHeader={false} />
          <PermitFormResponses responses={permit.formResponses ?? []} />
        </div>
      </details>

      <SuspensionDialog
        open={suspendOpen}
        reason={suspendReason}
        isSubmitting={isSubmitting}
        error={suspendError}
        onReasonChange={setSuspendReason}
        onConfirm={handleSuspend}
        onClose={() => {
          if (!isSubmitting) {
            setSuspendOpen(false);
            setSuspendReason("");
            setSuspendError(null);
          }
        }}
      />
    </PermitPageShell>
  );
}
