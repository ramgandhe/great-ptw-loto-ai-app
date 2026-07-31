"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listSimopsConflicts } from "@/lib/simops/api";
import type { ConflictSeverity, SimopsConflict } from "@/lib/simops/types";
import { ConflictSeverityBadge } from "@/components/simops/conflict-severity-badge";
import { Button } from "@/components/ui/button";

export default function ActiveConflictsPage() {
  const [conflicts, setConflicts] = useState<SimopsConflict[]>([]);
  const [severity, setSeverity] = useState<ConflictSeverity | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listSimopsConflicts()
      .then((rows) =>
        setConflicts(
          rows.filter((item) => item.status !== "approved" && item.status !== "rejected"),
        ),
      )
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load conflicts");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredConflicts =
    severity === "all"
      ? conflicts
      : conflicts.filter((item) => item.severity === severity);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Active conflicts</h1>
          <p className="text-sm text-muted-foreground">
            Review open SIMOPS conflicts before work proceeds.
          </p>
        </div>
        <Link href="/simops">
          <Button variant="outline">Dashboard</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "high", "medium", "low"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={severity === value ? "default" : "outline"}
            onClick={() => setSeverity(value)}
          >
            {value === "all" ? "All" : `${value[0].toUpperCase()}${value.slice(1)}`}
          </Button>
        ))}
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
        <p className="text-sm text-muted-foreground">Loading conflicts…</p>
      ) : filteredConflicts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No open conflicts match the current filters.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {filteredConflicts.map((conflict) => (
            <li key={conflict.id}>
              <Link
                href={`/simops/conflicts/${conflict.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <div>
                  <p className="font-medium">{conflict.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {conflict.conflictType.replace(/_/g, " ")} · Detected{" "}
                    {new Date(conflict.detectedAt).toLocaleString()}
                  </p>
                </div>
                <ConflictSeverityBadge severity={conflict.severity} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
