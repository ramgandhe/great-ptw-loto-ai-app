"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  approvePermit,
  deferPermit,
  getApprovalReview,
  rejectPermit,
} from "@/lib/approval/api";
import type { ApprovalReview } from "@/lib/approval/types";
import { permitDetailToForm } from "@/lib/permit/form";
import { ApprovalDialog } from "@/components/approval/approval-dialog";
import { ApprovalProgressIndicator } from "@/components/approval/approval-progress";
import { WorkflowTimeline } from "@/components/approval/workflow-timeline";
import { PermitSummary } from "@/components/permit/permit-summary";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

type DialogMode = "approve" | "reject" | "defer" | null;

export default function PermitReviewPage() {
  const params = useParams<{ permitId: string }>();
  const router = useRouter();
  const [review, setReview] = useState<ApprovalReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [comment, setComment] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getApprovalReview(params.permitId)
      .then(setReview)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load review"));
  }, [params.permitId]);

  const canAct =
    review?.permit.status === "pending_approval" && review.activeAssignment !== null;

  const activeStep = review?.activeAssignment?.step;

  function openDialog(mode: DialogMode) {
    setComment("");
    setDialogError(null);
    setDialogMode(mode);
  }

  function closeDialog() {
    if (!isSubmitting) {
      setDialogMode(null);
      setComment("");
      setDialogError(null);
    }
  }

  async function submitAction() {
    if (!dialogMode) {
      return;
    }

    setIsSubmitting(true);
    setDialogError(null);

    try {
      let updated: ApprovalReview;
      if (dialogMode === "approve") {
        updated = await approvePermit(params.permitId, comment);
      } else if (dialogMode === "reject") {
        updated = await rejectPermit(params.permitId, comment);
      } else {
        updated = await deferPermit(params.permitId, comment);
      }

      setReview(updated);
      setDialogMode(null);
      setComment("");

      if (dialogMode !== "approve" || updated.permit.status !== "pending_approval") {
        router.push("/approvals");
      }
    } catch (err) {
      setDialogError(err instanceof ApiError ? err.message : "Action failed");
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

  if (!review) {
    return <p className="p-8 text-sm text-muted-foreground">Loading permit review...</p>;
  }

  const form = permitDetailToForm(review);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{review.permit.title}</h1>
            <PermitStatusBadge status={review.permit.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {review.permit.reference ? `Reference ${review.permit.reference}` : "Permit review"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/approvals/${review.permit.id}/history`}>
            <Button variant="outline">Approval history</Button>
          </Link>
          <Link href="/approvals">
            <Button variant="ghost">Back to queue</Button>
          </Link>
        </div>
      </div>

      <ApprovalProgressIndicator workflow={review.workflow} />

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Workflow timeline</h2>
        <WorkflowTimeline workflow={review.workflow} />
      </section>

      <PermitSummary
        form={form}
        status={review.permit.status}
        reference={review.permit.reference}
      />

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Attachments</h2>
        {review.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments uploaded.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {review.attachments.map((attachment) => (
              <li key={attachment.id} className="rounded-lg border border-border px-3 py-2">
                {attachment.fileName} ({Math.round(attachment.fileSize / 1024)} KB)
              </li>
            ))}
          </ul>
        )}
      </section>

      {review.decisions.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold">Previous decisions</h2>
          <ul className="grid gap-2 text-sm">
            {review.decisions.map((decision) => (
              <li key={decision.id} className="rounded-lg border border-border px-3 py-2">
                <span className="font-medium capitalize">{decision.decision}</span>
                {decision.comment ? (
                  <p className="mt-1 text-muted-foreground">{decision.comment}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(decision.decidedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canAct ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button onClick={() => openDialog("approve")}>Approve</Button>
          <Button variant="destructive" onClick={() => openDialog("reject")}>
            Reject
          </Button>
          <Button variant="outline" onClick={() => openDialog("defer")}>
            Defer
          </Button>
        </div>
      ) : null}

      <ApprovalDialog
        open={dialogMode === "approve"}
        title="Approve permit"
        description="Confirm approval for this permit request."
        confirmLabel="Approve"
        comment={comment}
        commentRequired={activeStep?.commentRequiredOnApprove}
        commentLabel="Approval comment"
        isSubmitting={isSubmitting}
        error={dialogError}
        onCommentChange={setComment}
        onConfirm={submitAction}
        onClose={closeDialog}
      />

      <ApprovalDialog
        open={dialogMode === "reject"}
        title="Reject permit"
        description="Provide a reason for rejection. The job issuer will be notified."
        confirmLabel="Reject"
        confirmVariant="destructive"
        comment={comment}
        commentRequired={activeStep?.commentRequiredOnReject ?? true}
        commentLabel="Rejection reason"
        isSubmitting={isSubmitting}
        error={dialogError}
        onCommentChange={setComment}
        onConfirm={submitAction}
        onClose={closeDialog}
      />

      <ApprovalDialog
        open={dialogMode === "defer"}
        title="Defer permit"
        description="Request clarification from the job issuer before approval can continue."
        confirmLabel="Defer"
        comment={comment}
        commentRequired={activeStep?.commentRequiredOnDefer ?? true}
        commentLabel="Clarification request"
        isSubmitting={isSubmitting}
        error={dialogError}
        onCommentChange={setComment}
        onConfirm={submitAction}
        onClose={closeDialog}
      />
    </main>
  );
}
