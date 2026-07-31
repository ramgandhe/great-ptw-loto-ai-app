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
      .then(setItems)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load approval queue");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Approval queue</h1>
          <p className="text-sm text-muted-foreground">
            Review permits assigned to you for approval.
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
        <p className="text-sm text-muted-foreground">No pending approvals assigned to you.</p>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <ApprovalCard key={item.assignment.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
