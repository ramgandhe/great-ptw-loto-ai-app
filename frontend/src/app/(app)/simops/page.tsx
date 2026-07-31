"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { analyseSimopsConflicts, listSimopsAlerts, listSimopsConflicts } from "@/lib/simops/api";
import type { AlertListItem, SimopsConflict } from "@/lib/simops/types";
import { ConflictSeverityBadge } from "@/components/simops/conflict-severity-badge";
import { ConflictSummaryCards } from "@/components/simops/conflict-summary-cards";
import { Button } from "@/components/ui/button";

export default function SimopsDashboardPage() {
  const [conflicts, setConflicts] = useState<SimopsConflict[]>([]);
  const [alerts, setAlerts] = useState<AlertListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalysing, setIsAnalysing] = useState(false);

  async function load() {
    const [conflictRows, alertRows] = await Promise.all([
      listSimopsConflicts(),
      listSimopsAlerts(),
    ]);
    setConflicts(conflictRows.filter((item) => item.status !== "approved" && item.status !== "rejected"));
    setAlerts(alertRows.slice(0, 5));
  }

  useEffect(() => {
    load()
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load SIMOPS dashboard");
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function handleAnalyse() {
    setIsAnalysing(true);
    setError(null);
    try {
      await analyseSimopsConflicts();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Conflict analysis failed");
    } finally {
      setIsAnalysing(false);
    }
  }

  const highCount = conflicts.filter((item) => item.severity === "high").length;
  const mediumCount = conflicts.filter((item) => item.severity === "medium").length;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">SIMOPS dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor simultaneous operations conflicts across active permits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleAnalyse} disabled={isAnalysing}>
            {isAnalysing ? "Analysing…" : "Run analysis"}
          </Button>
          <Link href="/simops/conflicts">
            <Button variant="outline">Active conflicts</Button>
          </Link>
          <Link href="/simops/history">
            <Button variant="outline">History</Button>
          </Link>
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
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Open conflicts</p>
              <p className="text-2xl font-semibold">{conflicts.length}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">High severity</p>
              <p className="text-2xl font-semibold">{highCount}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">Medium severity</p>
              <p className="text-2xl font-semibold">{mediumCount}</p>
            </div>
          </div>

          <ConflictSummaryCards conflicts={conflicts} />

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Recent alerts</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts yet. Run analysis to detect conflicts.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {alerts.map(({ alert, conflict }) => (
                  <li key={alert.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {conflict.conflictType.replace(/_/g, " ")} · {alert.recipientRole}
                      </p>
                    </div>
                    <ConflictSeverityBadge severity={alert.severity} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
