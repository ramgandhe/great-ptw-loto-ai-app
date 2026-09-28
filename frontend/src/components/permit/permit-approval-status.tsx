"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry, ApprovalReview } from "@/lib/approval/types";
import { ApprovalProgressIndicator } from "@/components/approval/approval-progress";
import { WorkflowTimeline } from "@/components/approval/workflow-timeline";
import { PermitLifecycleTimeline } from "@/components/permit/permit-lifecycle-timeline";
import { resolveLifecyclePhases } from "@/lib/permit/lifecycle";
import { ChevronDown, History } from "lucide-react";
import { ApprovalHistoryList } from "@/components/approval/approval-history-list";

const APPROVAL_STATUSES = new Set([
  "pending_approval",
  "approved",
  "rejected",
  "deferred",
  "active",
  "suspended",
  "pending_closure",
  "closed",
]);

export function PermitApprovalStatus({
  permitId,
  status,
  draftStep = 0,
}: {
  permitId: string;
  status: string;
  draftStep?: number;
}) {
  const [review, setReview] = useState<ApprovalReview | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!APPROVAL_STATUSES.has(status)) {
      return;
    }

    Promise.all([
      getApprovalReview(permitId).catch(() => null),
      getApprovalHistory(permitId).catch(() => [] as ApprovalHistoryEntry[]),
    ])
      .then(([reviewData, historyData]) => {
        setReview(reviewData);
        setHistory(historyData);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load approval status");
      });
  }, [permitId, status]);

  if (!APPROVAL_STATUSES.has(status)) {
    return null;
  }

  const lifecyclePhases = resolveLifecyclePhases({
    permitStatus: status,
    draftStep,
    activeApprovalRole: review?.activeAssignment?.step.approverRole ?? null,
  });

  if (error) {
    return (
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Permit progress</h2>
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-3">

      <PermitLifecycleTimeline phases={lifecyclePhases} />

      {review && review.workflow.length > 0 ? (
        <>
          <ApprovalProgressIndicator workflow={review.workflow} />
          <WorkflowTimeline workflow={review.workflow} />
        </>
      ) : null}

      {status === "deferred" ? (
        <p className="text-sm text-muted-foreground">
          This permit was deferred for clarification. The issuer should update the permit and resubmit
          when ready.
        </p>
      ) : null}

      {status === "rejected" ? (
        <p className="text-sm text-muted-foreground">
          This permit was rejected. Review the approval history before creating a revised submission.
        </p>
      ) : null}

      {/* Opens in place: the decisions behind the lifecycle, without leaving the permit. */}
      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden />
            Approval history
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{history.length}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="reveal-in px-3 pb-3 pt-2">
          <ApprovalHistoryList entries={history} />
        </div>
      </details>
    </section>
  );
}
