"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { PermitStatusCard } from "@/components/execution/permit-status-card";
import { SupervisorDashboardWidget } from "@/components/execution/supervisor-dashboard-widget";

const EXECUTION_STATUSES = ["approved", "active", "suspended"] as const;

export default function ActivePermitsPage() {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    Promise.all(EXECUTION_STATUSES.map((status) => listPermits(status)))
      .then((groups) => setPermits(groups.flat()))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load permits");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const active = permits.filter((permit) => permit.status === "active");
  const suspended = permits.filter((permit) => permit.status === "suspended");
  const approved = permits.filter((permit) => permit.status === "approved");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Active permits</h1>
        <p className="text-sm text-muted-foreground">
          Activate approved permits, monitor ongoing work, and track suspended permits.
        </p>
      </div>

      <SupervisorDashboardWidget active={active} suspended={suspended} approved={approved} />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading permits...</p>
      ) : permits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No permits in execution phase.</p>
      ) : (
        <div className="grid gap-4">
          {approved.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="text-sm font-semibold">Ready to activate</h2>
              {approved.map((permit) => (
                <PermitStatusCard key={permit.id} permit={permit} />
              ))}
            </section>
          ) : null}
          {active.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="text-sm font-semibold">Active work</h2>
              {active.map((permit) => (
                <PermitStatusCard key={permit.id} permit={permit} subtitle="In progress" />
              ))}
            </section>
          ) : null}
          {suspended.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="text-sm font-semibold">Suspended</h2>
              {suspended.map((permit) => (
                <PermitStatusCard key={permit.id} permit={permit} subtitle="Suspended" />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
