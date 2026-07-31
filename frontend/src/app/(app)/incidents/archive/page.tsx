"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listIncidentArchive } from "@/lib/incidents/api";
import type { ArchivedIncident } from "@/lib/incidents/types";
import { IncidentStatusBadge } from "@/components/incidents/incident-status-badge";
import { Button } from "@/components/ui/button";

export default function IncidentArchivePage() {
  const [rows, setRows] = useState<ArchivedIncident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listIncidentArchive()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load archive"));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Incident archive</h1>
          <p className="text-sm text-muted-foreground">Closed incidents and historical records.</p>
        </div>
        <Link href="/incidents">
          <Button variant="outline">Active incidents</Button>
        </Link>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No archived incidents yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map(({ incident, closedAt }) => (
            <li key={incident.id}>
              <Link
                href={`/incidents/${incident.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-accent/40"
              >
                <div>
                  <p className="font-medium">{incident.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {incident.reference}
                    {closedAt ? ` · closed ${new Date(closedAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <IncidentStatusBadge status={incident.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
