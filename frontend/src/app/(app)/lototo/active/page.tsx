"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { PlanStatusBadge } from "@/components/lototo/plan-status-badge";
import { Button } from "@/components/ui/button";

const ACTIVE_STATUSES = new Set<LototoPlan["status"]>(["ready", "in_execution"]);

export default function ActiveLototoPage() {
  const [plans, setPlans] = useState<LototoPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listLototoPlans()
      .then((items) => setPlans(items.filter((plan) => ACTIVE_STATUSES.has(plan.status))))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load active LOTOTO plans");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/lototo" className="text-sm text-muted-foreground hover:text-foreground">
            ← LOTOTO plans
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Active LOTOTO</h1>
          <p className="text-sm text-muted-foreground">
            Plans ready for isolation execution or currently in progress.
          </p>
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
        <p className="text-sm text-muted-foreground">Loading active plans…</p>
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No plans are ready for isolation execution yet.
          </p>
          <Link href="/lototo" className="mt-4 inline-block">
            <Button variant="outline">View all plans</Button>
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {plans.map((plan) => (
            <li key={plan.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{plan.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.reference ?? "No reference"} · Permit {plan.permitId.slice(0, 8)}…
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PlanStatusBadge status={plan.status} />
                  <Link href={`/lototo/execute/${plan.id}`}>
                    <Button size="sm">
                      {plan.status === "ready" ? "Start isolation" : "Continue"}
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
