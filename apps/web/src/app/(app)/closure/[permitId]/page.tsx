"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { closePermit, getPermitAudit, getPermitHistory, verifyPermit } from "@/lib/closure/api";
import type { AuditLogEntry, PermitHistoryEntry, PermitVerification } from "@/lib/closure/types";
import { listEvidence, listProgress } from "@/lib/execution/api";
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

export default function PermitClosurePage() {
  const params = useParams<{ permitId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [verification, setVerification] = useState<PermitVerification | null>(null);
  const [history, setHistory] = useState<PermitHistoryEntry[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [checklist, setChecklist] = useState(defaultVerificationChecklist);
  const [comment, setComment] = useState("");
  const [closureComment, setClosureComment] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      getPermit(params.permitId),
      getPermitHistory(params.permitId).catch(() => []),
      getPermitAudit(params.permitId).catch(() => []),
      listProgress(params.permitId).catch(() => []),
      listEvidence(params.permitId).catch(() => []),
    ])
      .then(([permitDetail, historyItems, auditItems, progressItems, evidenceItems]) => {
        setDetail(permitDetail);
        setHistory(historyItems);
        setAudit(auditItems);
        setProgress(progressItems);
        setEvidence(evidenceItems);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load permit");
      });
  }, [params.permitId]);

  async function handleVerify() {
    if (!isChecklistComplete(checklist)) {
      setActionError("Complete all verification checklist items before submitting.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await verifyPermit(params.permitId, {
        checklist,
        comment: comment.trim() || undefined,
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
    setIsSubmitting(true);
    setCloseError(null);
    try {
      await closePermit(params.permitId, {
        comment: closureComment.trim() || undefined,
      });
      setCloseOpen(false);
      router.push("/closure/archive");
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : "Closure failed");
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

  const canClose = Boolean(verification) && detail.permit.status === "active";

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
              <li key={item.id} className="rounded-lg border border-border px-3 py-2">
                {item.fileName}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!verification ? (
        <section className="grid gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Verification checklist</h2>
          <VerificationChecklistPanel
            value={checklist}
            disabled={isSubmitting}
            onChange={setChecklist}
          />
          <textarea
            value={comment}
            disabled={isSubmitting}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Verification comments..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {actionError ? (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          ) : null}
          <Button onClick={handleVerify} disabled={isSubmitting || !isChecklistComplete(checklist)}>
            {isSubmitting ? "Submitting..." : "Submit verification"}
          </Button>
        </section>
      ) : (
        <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          Verification submitted {new Date(verification.verifiedAt).toLocaleString()}.
        </section>
      )}

      {canClose ? (
        <div>
          <Button onClick={() => setCloseOpen(true)} disabled={isSubmitting}>
            Close permit
          </Button>
        </div>
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
