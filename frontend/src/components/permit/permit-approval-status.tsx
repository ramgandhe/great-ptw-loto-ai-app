"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry, ApprovalReview } from "@/lib/approval/types";
import { ApprovalProgressIndicator } from "@/components/approval/approval-progress";
import { WorkflowTimeline } from "@/components/approval/workflow-timeline";
import { PermitLifecycleTimeline } from "@/components/permit/permit-lifecycle-timeline";
import { resolveLifecyclePhases } from "@/lib/permit/lifecycle";
import { Button } from "@/components/ui/button";

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
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Permit progress</h2>
        <Link href={`/approvals/${permitId}/history`}>
          <Button variant="outline" size="sm">
            View approval history
          </Button>
        </Link>
      </div>

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

      {!review && history.length > 0 ? (
        <ul className="grid gap-2 text-sm">
          {history.slice(0, 3).map((entry) => (
            <li key={entry.id} className="rounded-lg border border-border px-3 py-2">
              <span className="font-medium capitalize">{entry.action.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">
                {" "}
                · {new Date(entry.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
