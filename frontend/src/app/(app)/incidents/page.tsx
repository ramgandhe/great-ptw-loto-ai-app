"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Siren } from "lucide-react";
import { AnimatedNumber } from "@/components/analytics/animated-number";
import { SegmentedBar, StatTile } from "@/components/analytics/charts";
import { IncidentStatusBadge } from "@/components/incidents/incident-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { INCIDENT_TYPES, PRIORITIES } from "@/lib/analytics/labels";
import { formatRelative } from "@/lib/format";
import { listIncidents } from "@/lib/incidents/api";
import type { Incident } from "@/lib/incidents/types";
import { staggerContainer, staggerItem } from "@/lib/motion";

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const CLOSED = ["closed"];

function IncidentRow({ incident }: { incident: Incident }) {
  const priority = PRIORITIES.find((p) => p.key === incident.priority);
  return (
    <li className="relative flex flex-wrap items-center gap-x-6 gap-y-2 py-3 pl-5 pr-4">
      <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-full" style={{ backgroundColor: priority?.color }} />
      <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
        <Link href={`/incidents/${incident.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
          {incident.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className="font-mono">{incident.reference}</span>
          <span>{INCIDENT_TYPES[incident.incidentType]?.label ?? incident.incidentType}</span>
          <span>{priority?.label ?? incident.priority} priority</span>
          {incident.locationDescription ? <span>{incident.locationDescription}</span> : null}
          <span>{formatRelative(incident.occurredAt)}</span>
        </p>
      </div>
      <IncidentStatusBadge status={incident.status} />
    </li>
  );
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listIncidents()
      .then(setIncidents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Incidents could not be loaded. Try again."));
  }, []);

  const { open, closed } = useMemo(() => {
    const all = incidents ?? [];
    return {
      // Most serious first, then most recent.
      open: all
        .filter((i) => !CLOSED.includes(i.status))
        .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || b.occurredAt.localeCompare(a.occurredAt)),
      closed: all.filter((i) => CLOSED.includes(i.status)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    };
  }, [incidents]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Incidents</h1>
          <p className="mt-1 text-muted-foreground">Open incidents first, most serious at the top.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/incidents/archive" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Archive
          </Link>
          <Link href="/incidents/new" className={buttonVariants({ size: "lg" })}>
            <Siren aria-hidden />
            Report incident
          </Link>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {incidents === null ? (
        <p className="text-sm text-muted-foreground">Loading incidents…</p>
      ) : incidents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          No incidents recorded. Report near misses too: they are how the next accident is prevented.
        </p>
      ) : (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-6">
          <motion.div variants={staggerItem} className="grid gap-3 md:grid-cols-[repeat(2,12rem)_1fr]">
            <StatTile label="Open" value={<AnimatedNumber value={open.length} />} tone={open.length > 0 ? "warning" : "neutral"} />
            <StatTile label="Closed" value={<AnimatedNumber value={closed.length} />} />
            <div className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="mb-3 text-sm font-medium">Open by priority</p>
              <SegmentedBar
                emptyMessage="Nothing open."
                segments={PRIORITIES.map((p) => ({ ...p, count: open.filter((i) => i.priority === p.key).length }))}
              />
            </div>
          </motion.div>

          {open.length > 0 ? (
            <motion.section variants={staggerItem} aria-labelledby="open-incidents">
              <h2 id="open-incidents" className="mb-2 font-semibold">
                Needs follow-up <span className="font-normal text-muted-foreground">{open.length}</span>
              </h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
                {open.map((incident) => (
                  <IncidentRow key={incident.id} incident={incident} />
                ))}
              </ul>
            </motion.section>
          ) : null}

          {closed.length > 0 ? (
            <motion.section variants={staggerItem} aria-labelledby="closed-incidents">
              <h2 id="closed-incidents" className="mb-2 font-semibold text-muted-foreground">
                Closed <span className="font-normal">{closed.length}</span>
              </h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4 opacity-85">
                {closed.map((incident) => (
                  <IncidentRow key={incident.id} incident={incident} />
                ))}
              </ul>
            </motion.section>
          ) : null}
        </motion.div>
      )}
    </main>
  );
}
