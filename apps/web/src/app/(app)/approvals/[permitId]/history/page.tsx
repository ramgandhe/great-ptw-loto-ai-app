"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry } from "@/lib/approval/types";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { Button } from "@/components/ui/button";

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
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Approval history</h1>
            {status ? <PermitStatusBadge status={status} /> : null}
          </div>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        <Link href={`/approvals/${params.permitId}`}>
          <Button variant="outline">Back to review</Button>
        </Link>
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
        <ol className="grid gap-3">
          {history.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium capitalize">{entry.action.replace(/_/g, " ")}</span>
                <time className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </div>
              {entry.fromStatus || entry.toStatus ? (
                <p className="mt-1 text-muted-foreground">
                  {entry.fromStatus?.replace(/_/g, " ") ?? "—"} →{" "}
                  {entry.toStatus?.replace(/_/g, " ") ?? "—"}
                </p>
              ) : null}
              {entry.comment ? (
                <p className="mt-2 rounded-md bg-muted/50 px-3 py-2">{entry.comment}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
