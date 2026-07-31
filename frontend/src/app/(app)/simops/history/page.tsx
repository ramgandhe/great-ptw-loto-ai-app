"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listSimopsHistory } from "@/lib/simops/api";
import type { HistoryListItem } from "@/lib/simops/types";
import { ConflictSeverityBadge } from "@/components/simops/conflict-severity-badge";
import { Button } from "@/components/ui/button";

export default function SimopsHistoryPage() {
  const [records, setRecords] = useState<HistoryListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listSimopsHistory()
      .then(setRecords)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load conflict history");
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Conflict history</h1>
          <p className="text-sm text-muted-foreground">Resolved SIMOPS conflicts and decisions.</p>
        </div>
        <Link href="/simops">
          <Button variant="outline">Dashboard</Button>
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
        <p className="text-sm text-muted-foreground">Loading history…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">No resolved conflicts yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {records.map(({ conflict, resolution }) => (
            <li key={conflict.id}>
              <Link
                href={`/simops/history/${conflict.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <div>
                  <p className="font-medium">{conflict.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {resolution.outcome} · {new Date(resolution.resolvedAt).toLocaleString()}
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
