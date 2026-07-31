"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { PlanStatusBadge } from "@/components/lototo/plan-status-badge";
import { Button } from "@/components/ui/button";

export default function LototoPlansPage() {
  const [plans, setPlans] = useState<LototoPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listLototoPlans()
      .then(setPlans)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load LOTOTO plans");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">LOTOTO plans</h1>
          <p className="text-sm text-muted-foreground">
            Configure hazardous energy isolation before permit execution.
          </p>
        </div>
        <Link href="/lototo/plans/new">
          <Button>New LOTOTO plan</Button>
        </Link>
        <Link href="/lototo/active">
          <Button variant="outline">Active LOTOTO</Button>
        </Link>
        <Link href="/lototo/restoration">
          <Button variant="outline">Restoration</Button>
        </Link>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading plans…</p>
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No LOTOTO plans yet.</p>
          <Link href="/lototo/plans/new" className="mt-4 inline-block">
            <Button variant="outline">Create first plan</Button>
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                href={`/lototo/plans/${plan.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <div>
                  <p className="font-medium">{plan.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.reference ?? "No reference"} · Permit {plan.permitId.slice(0, 8)}…
                  </p>
                </div>
                <PlanStatusBadge status={plan.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
