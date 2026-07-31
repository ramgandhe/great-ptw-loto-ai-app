"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getIsolationExecutionForPlan } from "@/lib/isolation-execution/api";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { ExecutionStatusBadge } from "@/components/isolation-execution/execution-status-badge";
import { Button } from "@/components/ui/button";

type RestorationCandidate = {
  plan: LototoPlan;
  executionId: string;
  status: "verified" | "restored";
};

export default function RestorationListPage() {
  const [candidates, setCandidates] = useState<RestorationCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listLototoPlans()
      .then(async (plans) => {
        const active = plans.filter((plan) => plan.status === "in_execution");
        const results: RestorationCandidate[] = [];

        for (const plan of active) {
          try {
            const detail = await getIsolationExecutionForPlan(plan.id);
            if (detail.execution.status === "verified" || detail.execution.status === "restored") {
              results.push({
                plan,
                executionId: detail.execution.id,
                status: detail.execution.status,
              });
            }
          } catch {
            // Plan may not have an execution yet — skip.
          }
        }

        setCandidates(results);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load restoration queue");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/lototo" className="text-sm text-muted-foreground hover:text-foreground">
          ← LOTOTO plans
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Equipment restoration</h1>
        <p className="text-sm text-muted-foreground">
          Remove locks and tags, restore equipment, and complete LOTOTO after verified isolation.
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading restoration queue…</p>
      ) : candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No verified isolations awaiting restoration.
          </p>
          <Link href="/lototo/active" className="mt-4 inline-block">
            <Button variant="outline">View active LOTOTO</Button>
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {candidates.map((item) => (
            <li key={item.executionId}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{item.plan.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.plan.reference ?? "No reference"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ExecutionStatusBadge status={item.status} />
                  <Link href={`/lototo/restoration/${item.executionId}`}>
                    <Button size="sm">
                      {item.status === "verified" ? "Restore" : "View summary"}
                    </Button>
                  </Link>
                  <Link href={`/lototo/history/${item.plan.id}`}>
                    <Button size="sm" variant="outline">
                      History
                    </Button>
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
