"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry, ApprovalReview } from "@/lib/approval/types";
import { ApprovalProgressIndicator } from "@/components/approval/approval-progress";
import { WorkflowTimeline } from "@/components/approval/workflow-timeline";
import { Button } from "@/components/ui/button";

const APPROVAL_STATUSES = new Set([
  "pending_approval",
  "approved",
  "rejected",
  "deferred",
]);

export function PermitApprovalStatus({ permitId, status }: { permitId: string; status: string }) {
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
    ]).then(([reviewData, historyData]) => {
      setReview(reviewData);
      setHistory(historyData);
    }).catch((err) => {
      setError(err instanceof ApiError ? err.message : "Failed to load approval status");
    });
  }, [permitId, status]);

  if (!APPROVAL_STATUSES.has(status)) {
    return null;
  }

  if (error) {
    return (
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Approval status</h2>
        <p className="text-sm text-destructive" role="alert">{error}</p>
      </section>
    );
  }

  if (!review && history.length === 0) {
    return (
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Approval status</h2>
        <p className="text-sm text-muted-foreground">No approval activity recorded yet.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Approval status</h2>
        <Link href={`/approvals/${permitId}/history`}>
          <Button variant="outline" size="sm">
            View approval history
          </Button>
        </Link>
      </div>

      {review ? (
        <>
          <ApprovalProgressIndicator workflow={review.workflow} />
          <WorkflowTimeline workflow={review.workflow} />
        </>
      ) : null}

      {status === "deferred" ? (
        <p className="text-sm text-muted-foreground">
          This permit was deferred for clarification. Update the permit and resubmit when ready.
        </p>
      ) : null}

      {status === "rejected" ? (
        <p className="text-sm text-muted-foreground">
          This permit was rejected. Review the approval history before creating a revised submission.
        </p>
      ) : null}

      {status === "approved" ? (
        <p className="text-sm text-muted-foreground">
          All required approvals are complete. This permit can proceed to execution.
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
