"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry } from "@/lib/approval/types";
import { ApprovalHistoryList } from "@/components/approval/approval-history-list";
import { BackLink } from "@/components/layout/page-header";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";

export default function ApprovalHistoryPage() {
  const params = useParams<{ permitId: string }>();
  const [title, setTitle] = useState<string>("Permit");
  const [status, setStatus] = useState<string>("");
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    Promise.all([getApprovalReview(params.permitId), getApprovalHistory(params.permitId)])
      .then(([review, entries]) => {
        setTitle(review.permit.title);
        setStatus(review.permit.status);
        setHistory(entries);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load approval history");
      })
      .finally(() => setIsLoading(false));
  }, [params.permitId]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <BackLink href={`/permits/${params.permitId}`} label="Permit details" />
          <div className="mb-2 flex items-center gap-3">
            <h1 className="font-heading text-3xl font-bold tracking-tight">Approval history</h1>
            {status ? <PermitStatusBadge status={status} /> : null}
          </div>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>

      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading approval history...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No approval history recorded yet.</p>
      ) : (
        <ApprovalHistoryList entries={history} />
      )}
    </main>
  );
}
