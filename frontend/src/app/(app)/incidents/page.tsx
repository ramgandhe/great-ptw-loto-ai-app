"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listIncidents } from "@/lib/incidents/api";
import type { Incident } from "@/lib/incidents/types";
import { IncidentStatusBadge } from "@/components/incidents/incident-status-badge";
import { Button } from "@/components/ui/button";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listIncidents()
      .then(setIncidents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load incidents"));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-sm text-muted-foreground">
            Report and track workplace incidents, near misses and unsafe conditions.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/incidents/archive">
            <Button variant="outline">Archive</Button>
          </Link>
          <Link href="/incidents/new">
            <Button>Report incident</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No incidents recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <Link
                href={`/incidents/${incident.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-accent/40"
              >
                <div>
                  <p className="font-medium">{incident.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {incident.reference} · {incident.incidentType.replace(/_/g, " ")}
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
