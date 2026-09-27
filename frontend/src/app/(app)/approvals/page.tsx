"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listPendingApprovals } from "@/lib/approval/api";
import type { PendingApprovalItem } from "@/lib/approval/types";
import { ApprovalCard } from "@/components/approval/approval-card";
import { Button } from "@/components/ui/button";

export default function ApprovalQueuePage() {
  const [items, setItems] = useState<PendingApprovalItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    listPendingApprovals()
      // Longest-waiting first.
      .then((rows) => setItems([...rows].sort((a, b) => (a.permit.submittedAt ?? "").localeCompare(b.permit.submittedAt ?? ""))))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load approval queue");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Permits waiting for your decision." : items.length === 0 ? "Nothing is waiting for your decision." : `${items.length} permit${items.length === 1 ? "" : "s"} waiting for your decision, longest-waiting first.`}
          </p>
        </div>
        <Link href="/approvals/deferred">
          <Button variant="outline">Deferred permits</Button>
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
        <p className="text-sm text-muted-foreground">Loading approval queue...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">You are all caught up. New permits routed to you will appear here.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <ApprovalCard key={item.assignment.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
