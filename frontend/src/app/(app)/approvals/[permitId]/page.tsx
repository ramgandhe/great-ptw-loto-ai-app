"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, History, RotateCcw, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { approvePermit, deferPermit, getApprovalReview, rejectPermit } from "@/lib/approval/api";
import type { ApprovalReview } from "@/lib/approval/types";
import { formatDateTime, formatStatus } from "@/lib/format";
import { permitDetailToForm } from "@/lib/permit/form";
import { cn } from "@/lib/utils";
import { useWorkQueue } from "@/lib/work-queue-context";
import { WorkflowTimeline } from "@/components/approval/workflow-timeline";
import { PermitSummary, permitGaps } from "@/components/permit/permit-summary";
import { PermitFormResponses } from "@/components/permit/permit-form-responses";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";

type Decision = "approve" | "defer" | "reject";

const DECISIONS: Record<Decision, { label: string; done: string; prompt: string; placeholder: string }> = {
  approve: {
    label: "Approve",
    done: "Approved",
    prompt: "Comment for the record",
    placeholder: "Optional note for the next approver and the issuer",
  },
  defer: {
    label: "Send back for changes",
    done: "Sent back",
    prompt: "What needs to change?",
    placeholder: "The issuer sees this and can resubmit",
  },
  reject: {
    label: "Reject",
    done: "Rejected",
    prompt: "Why is it rejected?",
    placeholder: "The issuer sees this reason",
  },
};

/** Common reasons so a reviewer can pick instead of typing. */
const COMMON_REASONS = [
  "Hazard assessment incomplete",
  "PPE does not match the hazards",
  "Isolation plan missing or unclear",
  "Clashes with other work in the area",
  "Work scope needs more detail",
];

export default function PermitReviewPage() {
  const params = useParams<{ permitId: string }>();
  const router = useRouter();
  const { items } = useWorkQueue();
  const [review, setReview] = useState<ApprovalReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getApprovalReview(params.permitId)
      .then(setReview)
      .catch((err) => setError(err instanceof ApiError ? err.message : "This permit could not be loaded."));
  }, [params.permitId]);

  const nextReview = useMemo(
    () => items.find((item) => item.action === "review" && item.permit && item.permit.id !== params.permitId),
    [items, params.permitId],
  );

  if (error) {
    return (
      <main className="p-8">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Link href="/approvals" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
          Back to approvals
        </Link>
      </main>
    );
  }

  if (!review) {
    return <p className="p-8 text-sm text-muted-foreground">Loading permit…</p>;
  }

  const form = permitDetailToForm(review);
  const gaps = permitGaps(form);
  const step = review.activeAssignment?.step;
  const canAct = review.permit.status === "pending_approval" && review.activeAssignment !== null;
  const commentRequired =
    decision === "approve"
      ? Boolean(step?.commentRequiredOnApprove)
      : decision === "reject"
        ? (step?.commentRequiredOnReject ?? true)
        : decision === "defer"
          ? (step?.commentRequiredOnDefer ?? true)
          : false;
  const suggestions = decision && decision !== "approve" ? [...(gaps.length ? [`Missing: ${gaps.join(", ")}`] : []), ...COMMON_REASONS] : [];

  async function submit() {
    if (!decision) return;
    if (commentRequired && !comment.trim()) {
      setActionError("Add a comment before confirming. The issuer needs to know what to change.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const run = decision === "approve" ? approvePermit : decision === "reject" ? rejectPermit : deferPermit;
      const updated = await run(params.permitId, comment.trim());
      setReview(updated);
      setDecision(null);
      setComment("");
      // Another stage of this permit may also be yours; otherwise move on to the next permit.
      if (!(decision === "approve" && updated.permit.status === "pending_approval" && updated.activeAssignment)) {
        router.push(nextReview ? nextReview.href : "/approvals");
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "The decision was not saved. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div>
        <Link href="/approvals" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Approvals
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{review.permit.title}</h1>
          <PermitStatusBadge status={review.permit.status} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          {review.permit.reference ? <span className="font-mono">{review.permit.reference}</span> : null}
          {review.permit.submittedAt ? <span>Submitted {formatDateTime(review.permit.submittedAt)}</span> : null}
          <Link href={`/permits/${review.permit.id}`} className="underline-offset-4 hover:underline">
            Open full permit
          </Link>
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <PermitSummary form={form} status={review.permit.status} attachments={review.attachments} showHeader={false} />
          <PermitFormResponses responses={review.permit.formResponses ?? []} />
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-20">
          <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="decision-heading">
            <h2 id="decision-heading" className="font-semibold">
              {canAct ? "Your decision" : "Decision"}
            </h2>
            {step ? <p className="mt-0.5 text-sm text-muted-foreground">Stage: {step.name}</p> : null}

            {!canAct ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing to decide here. The permit is {formatStatus(review.permit.status).toLowerCase()}.
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Decision">
                  {(Object.keys(DECISIONS) as Decision[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={decision === key}
                      onClick={() => {
                        setDecision(key);
                        setActionError(null);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                        decision === key
                          ? key === "reject"
                            ? "border-(--status-danger) bg-(--status-danger-bg) text-(--status-danger)"
                            : "border-primary bg-primary/10 text-foreground"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {key === "approve" ? <Check className="size-4" aria-hidden /> : key === "defer" ? <RotateCcw className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                      {DECISIONS[key].label}
                    </button>
                  ))}
                </div>

                {decision ? (
                  <div className="mt-4 grid gap-2">
                    <label htmlFor="decision-comment" className="text-sm font-medium">
                      {DECISIONS[decision].prompt}
                      {commentRequired ? "" : <span className="font-normal text-muted-foreground"> (optional)</span>}
                    </label>
                    {suggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => setComment((c) => (c.trim() ? `${c.trim()}\n${reason}` : reason))}
                            className="rounded-full border border-border px-2.5 py-1 text-left text-xs hover:bg-muted"
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <textarea
                      id="decision-comment"
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={DECISIONS[decision].placeholder}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    {actionError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {actionError}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant={decision === "reject" ? "destructive" : "default"}
                      className="h-10"
                      disabled={isSubmitting}
                      onClick={submit}
                    >
                      {isSubmitting ? "Saving…" : `${DECISIONS[decision].label}${nextReview ? " and open next" : ""}`}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="flow-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="flow-heading" className="font-semibold">
                Approval route
              </h2>
              <Link
                href={`/approvals/${review.permit.id}/history`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <History className="size-3.5" aria-hidden />
                History
              </Link>
            </div>
            <div className="mt-3">
              <WorkflowTimeline workflow={review.workflow} />
            </div>
            {review.decisions.length > 0 ? (
              <ul className="mt-4 grid gap-3 border-t border-border pt-4 text-sm">
                {review.decisions.map((d) => (
                  <li key={d.id}>
                    <p className="font-medium">
                      {formatStatus(d.decision)}
                      <span className="ml-2 font-normal text-muted-foreground">{formatDateTime(d.decidedAt)}</span>
                    </p>
                    {d.comment ? <p className="mt-0.5 text-muted-foreground">{d.comment}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
}
