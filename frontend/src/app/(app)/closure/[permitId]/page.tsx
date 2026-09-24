"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { closePermit, getPermitAudit, getPermitHistory, getPermitVerification, verifyPermit } from "@/lib/closure/api";
import { sendBackToExecutor, sendBackToIssuer } from "@/lib/execution/api";
import type { AuditLogEntry, PermitHistoryEntry, PermitVerification } from "@/lib/closure/types";
import { getEvidenceDownloadUrl, listEvidence, listProgress } from "@/lib/execution/api";
import type { EvidenceRecord, ProgressRecord } from "@/lib/execution/types";
import { getPermit } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";
import { AuditTimeline } from "@/components/closure/audit-timeline";
import { ClosureDialog } from "@/components/closure/closure-dialog";
import { HistoryTimeline } from "@/components/closure/history-timeline";
import { ReadonlyPermitViewer } from "@/components/closure/readonly-permit-viewer";
import {
  defaultVerificationChecklist,
  isChecklistComplete,
  VerificationChecklistPanel,
} from "@/components/closure/verification-checklist";
import { ProgressFeed } from "@/components/execution/progress-feed";
import { Button } from "@/components/ui/button";
import { openPresignedDownload } from "@/lib/download";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";

export default function PermitClosurePage() {
  const params = useParams<{ permitId: string }>();
  const router = useRouter();
  const { roles } = useAuthProfile();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [verification, setVerification] = useState<PermitVerification | null>(null);
  const [history, setHistory] = useState<PermitHistoryEntry[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [checklist, setChecklist] = useState(defaultVerificationChecklist);
  const [comment, setComment] = useState("");
  const [sendBackComment, setSendBackComment] = useState("");
  const [closureComment, setClosureComment] = useState("");
  const [closeChecklist, setCloseChecklist] = useState(defaultVerificationChecklist);
  const [closeOpen, setCloseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingEvidenceId, setDownloadingEvidenceId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getPermit(params.permitId),
      getPermitVerification(params.permitId).catch(() => null),
      getPermitHistory(params.permitId).catch(() => []),
      getPermitAudit(params.permitId).catch(() => []),
      listProgress(params.permitId).catch(() => []),
      listEvidence(params.permitId).catch(() => []),
    ])
      .then(([permitDetail, verificationRecord, historyItems, auditItems, progressItems, evidenceItems]) => {
        setDetail(permitDetail);
        setVerification(verificationRecord);
        setHistory(historyItems);
        setAudit(auditItems);
        setProgress(progressItems);
        setEvidence(evidenceItems);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load permit");
      });
  }, [params.permitId]);

  async function handleEvidenceDownload(evidenceId: string) {
    setDownloadingEvidenceId(evidenceId);
    try {
      await openPresignedDownload(() => getEvidenceDownloadUrl(params.permitId, evidenceId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Download failed");
    } finally {
      setDownloadingEvidenceId(null);
    }
  }

  async function handleVerify() {
    if (!comment.trim()) {
      setActionError("A verification comment is required.");
      return;
    }
    if (!isChecklistComplete(checklist)) {
      setActionError("Complete all verification checklist items before submitting.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await verifyPermit(params.permitId, {
        checklist,
        comment: comment.trim(),
      });
      setVerification(result.verification);
      setDetail((current) => (current ? { ...current, permit: result.permit } : current));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClose() {
    if (!closureComment.trim() || !isChecklistComplete(closeChecklist)) {
      setCloseError("Complete the closure checklist and add a comment.");
      return;
    }
    setIsSubmitting(true);
    setCloseError(null);
    try {
      await closePermit(params.permitId, {
        comment: closureComment.trim(),
        checklist: closeChecklist,
      });
      setCloseOpen(false);
      router.push("/closure/archive");
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : "Closure failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendBackToExecutor() {
    if (!sendBackComment.trim()) {
      setActionError("A send-back comment is required.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await sendBackToExecutor(params.permitId, sendBackComment.trim());
      setDetail(updated);
      setVerification(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Send back failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendBackToIssuer() {
    if (!sendBackComment.trim()) {
      setActionError("A send-back comment is required.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await sendBackToIssuer(params.permitId, sendBackComment.trim());
      setDetail(updated);
      setVerification(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Send back failed");
    } finally {
      setIsSubmitting(false);
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
    return <p className="p-8 text-sm text-muted-foreground">Loading permit closure...</p>;
  }

  const canVerify = detail.permit.status === "execution_completed" && hasAnyRole(roles, ["job-issuer", "tenant-owner", "tenant-admin", "platform-admin"]);
  const canSendBackToExecutor = detail.permit.status === "execution_completed" && hasAnyRole(roles, ["job-issuer", "tenant-owner", "tenant-admin", "platform-admin"]);
  const canClose = Boolean(verification) && detail.permit.status === "pending_closure" && hasAnyRole(roles, ["hod", "tenant-owner", "tenant-admin", "platform-admin"]);
  const canSendBackToIssuer = detail.permit.status === "pending_closure" && hasAnyRole(roles, ["hod", "tenant-owner", "tenant-admin", "platform-admin"]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Verify & close</h1>
          <p className="text-sm text-muted-foreground">{detail.permit.title}</p>
        </div>
        <Link href="/closure">
          <Button variant="ghost">Back to queue</Button>
        </Link>
      </div>

      <ReadonlyPermitViewer detail={detail} verification={verification} />

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Execution progress</h2>
        <ProgressFeed items={progress.slice().reverse()} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Evidence ({evidence.length})</h2>
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence uploaded.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {evidence.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span>{item.fileName}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={downloadingEvidenceId === item.id}
                  onClick={() => void handleEvidenceDownload(item.id)}
                >
                  {downloadingEvidenceId === item.id ? "Opening..." : "Download"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canVerify ? (
        <section className="grid gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Issuer verification</h2>
          <VerificationChecklistPanel
            value={checklist}
            disabled={isSubmitting}
            onChange={setChecklist}
          />
          <textarea
            value={comment}
            disabled={isSubmitting}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Verification comments (required)"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {actionError ? (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          ) : null}
          <Button onClick={handleVerify} disabled={isSubmitting || !isChecklistComplete(checklist) || !comment.trim()}>
            {isSubmitting ? "Submitting..." : "Submit verification"}
          </Button>
        </section>
      ) : verification ? (
        <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          Verification submitted {new Date(verification.verifiedAt).toLocaleString()}.
        </section>
      ) : null}

      {canSendBackToExecutor ? (
        <section className="grid gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Send back to executor</h2>
          <textarea
            value={sendBackComment}
            disabled={isSubmitting}
            onChange={(event) => setSendBackComment(event.target.value)}
            placeholder="Reason for sending back (required)"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" onClick={() => void handleSendBackToExecutor()} disabled={isSubmitting || !sendBackComment.trim()}>
            Send back to executor
          </Button>
        </section>
      ) : null}

      {canSendBackToIssuer ? (
        <section className="grid gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Send back to issuer</h2>
          <textarea
            value={sendBackComment}
            disabled={isSubmitting}
            onChange={(event) => setSendBackComment(event.target.value)}
            placeholder="Reason for sending back (required)"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" onClick={() => void handleSendBackToIssuer()} disabled={isSubmitting || !sendBackComment.trim()}>
            Send back to issuer
          </Button>
        </section>
      ) : null}

      {canClose ? (
        <section className="grid gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">HOD closure</h2>
          <VerificationChecklistPanel
            value={closeChecklist}
            disabled={isSubmitting}
            onChange={setCloseChecklist}
          />
          <Button onClick={() => setCloseOpen(true)} disabled={isSubmitting || !isChecklistComplete(closeChecklist)}>
            Close permit
          </Button>
        </section>
      ) : null}

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Lifecycle history</h2>
        <HistoryTimeline entries={history} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Audit log</h2>
        <AuditTimeline entries={audit} />
      </section>

      <ClosureDialog
        open={closeOpen}
        comment={closureComment}
        isSubmitting={isSubmitting}
        error={closeError}
        onCommentChange={setClosureComment}
        onConfirm={handleClose}
        onClose={() => {
          if (!isSubmitting) {
            setCloseOpen(false);
            setCloseError(null);
          }
        }}
      />
    </main>
  );
}
