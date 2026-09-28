"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Siren } from "lucide-react";
import { AnimatedNumber } from "@/components/analytics/animated-number";
import { StatTile } from "@/components/analytics/charts";
import { IncidentStatusBadge } from "@/components/incidents/incident-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { IncidentReportPanel } from "@/components/safety/create-panels";
import { EmptyState, ErrorNote, RecordList, RecordRow } from "@/components/safety/record-list";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { MultiToggle, SegmentedToggle } from "@/components/ui/toggle-group";
import { ActionLink } from "@/components/work/action-link";
import { ApiError } from "@/lib/api";
import { INCIDENT_TYPES, PRIORITIES } from "@/lib/analytics/labels";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { INCIDENT_REPORT_ROLES } from "@/lib/auth/roles";
import { formatRelative } from "@/lib/format";
import { listIncidents } from "@/lib/incidents/api";
import type { Incident } from "@/lib/incidents/types";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { INCIDENT_STATUS } from "@/lib/safety/status";
import { useWorkQueue } from "@/lib/work-queue-context";

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const list = (value: string | null) => (value ?? "").split(",").filter(Boolean);

function IncidentsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { roles } = useAuthProfile();
  const { items } = useWorkQueue();
  const canReport = hasAnyRole(roles, INCIDENT_REPORT_ROLES);
  const view = params.get("view") === "closed" ? "closed" : "open";
  const priorities = list(params.get("priority"));
  const types = list(params.get("type"));
  const statuses = list(params.get("status"));
  const reporting = params.get("new") === "1" && canReport;

  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ incident: Incident; submitted: boolean } | null>(null);

  function setParams(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    listIncidents()
      .then(setIncidents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Incidents could not be loaded. Try again."));
  }, []);

  // What the signed-in person must do on each incident, from the shared work queue.
  const actionByIncident = useMemo(() => new Map(items.filter((i) => !i.permit && i.href.startsWith("/incidents/")).map((i) => [i.href.split("/")[2], i])), [items]);

  const all = incidents ?? [];
  const open = all.filter((i) => i.status !== "closed");
  const closed = all.filter((i) => i.status === "closed");
  const source = view === "open" ? open : closed;
  const rows = source
    .filter(
      (i) =>
        (priorities.length === 0 || priorities.includes(i.priority)) &&
        (types.length === 0 || types.includes(i.incidentType)) &&
        (statuses.length === 0 || statuses.includes(i.status)),
    )
    // Needs you first, then most serious, then most recent.
    .sort(
      (a, b) =>
        Number(actionByIncident.has(b.id)) - Number(actionByIncident.has(a.id)) ||
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
        b.occurredAt.localeCompare(a.occurredAt),
    );

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        title="Incidents"
        description="Incidents, near misses and unsafe conditions. The most serious open ones come first."
        actions={
          canReport && !reporting ? (
            <Button type="button" size="lg" onClick={() => setParams({ new: "1" })}>
              <Siren aria-hidden />
              Report incident
            </Button>
          ) : null
        }
      >
        <SegmentedToggle
          label="View"
          value={view}
          onChange={(v) => setParams({ view: v === "open" ? "" : v, status: "" })}
          options={[
            { value: "open", label: "Needs follow-up", count: open.length },
            { value: "closed", label: "Closed", count: closed.length },
          ]}
          className="self-start"
        />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <MultiToggle
            label="Priority"
            selected={priorities}
            onChange={(next) => setParams({ priority: next.join(",") })}
            options={PRIORITIES.map((p) => ({ value: p.key, label: p.label, color: p.color, count: source.filter((i) => i.priority === p.key).length }))}
          />
          <MultiToggle
            label="Type"
            selected={types}
            onChange={(next) => setParams({ type: next.join(",") })}
            options={Object.entries(INCIDENT_TYPES).map(([key, t]) => ({ value: key, label: t.label, color: t.color, count: source.filter((i) => i.incidentType === key).length }))}
          />
          {view === "open" ? (
            <MultiToggle
              label="Status"
              selected={statuses}
              onChange={(next) => setParams({ status: next.join(",") })}
              options={Object.entries(INCIDENT_STATUS)
                .filter(([key]) => key !== "closed")
                .map(([key, tone]) => ({ value: key, label: tone.label, color: tone.color, count: open.filter((i) => i.status === key).length }))
                .filter((o) => o.count > 0 || statuses.includes(o.value))}
            />
          ) : null}
        </div>

        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { label: "Open", value: open.length, tone: "warning" as const, href: "/incidents" },
            { label: "Critical or high, open", value: open.filter((i) => i.priority === "critical" || i.priority === "high").length, tone: "danger" as const, href: "/incidents?priority=critical,high" },
            { label: "Awaiting HOD decision", value: open.filter((i) => i.status === "pending_hod_decision").length, tone: "warning" as const, href: "/incidents?status=pending_hod_decision" },
            { label: "Closed", value: closed.length, href: "/incidents?view=closed" },
          ].map((t) => (
            <motion.div key={t.label} variants={staggerItem}>
              <StatTile compact label={t.label} value={<AnimatedNumber value={t.value} />} href={t.href} tone={t.tone && t.value > 0 ? t.tone : "neutral"} />
            </motion.div>
          ))}
        </motion.div>
      </PageHeader>

      {reporting ? (
        <IncidentReportPanel
          initialPermitId={params.get("permitId") ?? undefined}
          onClose={() => setParams({ new: "", permitId: "" })}
          onCreated={(incident, submitted) => {
            setIncidents((current) => [incident, ...(current ?? [])]);
            setSaved({ incident, submitted });
            setParams({ new: "", permitId: "", view: "" });
          }}
        />
      ) : null}

      {saved ? (
        <p role="status" className="reveal-in text-sm font-medium text-(--status-success)">
          {saved.submitted ? "Reported" : "Saved as draft"}:{" "}
          <Link href={`/incidents/${saved.incident.id}`} className="underline">
            {saved.incident.reference ?? saved.incident.title}
          </Link>
          .
        </p>
      ) : null}

      <ErrorNote message={error} />

      {incidents === null ? (
        <p className="text-sm text-muted-foreground">Loading incidents…</p>
      ) : (
        <>

          {rows.length === 0 ? (
            <EmptyState
              title={view === "open" ? "No open incidents match" : "No closed incidents match"}
              hint={all.length === 0 ? "Report near misses too: they are how the next accident is prevented." : "Remove a filter above to widen the list."}
            />
          ) : (
            <RecordList headers={["Incident", "Where and when", "Status", "Next step"]}>
              {rows.map((incident, i) => {
                const priority = PRIORITIES.find((p) => p.key === incident.priority);
                const type = INCIDENT_TYPES[incident.incidentType];
                const action = actionByIncident.get(incident.id);
                return (
                  <RecordRow
                    key={incident.id}
                    index={i}
                    href={`/incidents/${incident.id}`}
                    title={incident.title}
                    reference={incident.reference}
                    meta={
                      <>
                        {type ? <StatusChip label={type.label} color={type.color} className="py-0" /> : null}
                        {priority ? <StatusChip label={`${priority.label} priority`} color={priority.color} className="py-0" /> : null}
                      </>
                    }
                    context={
                      <span>
                        {incident.locationDescription ? <span className="block truncate text-foreground">{incident.locationDescription}</span> : null}
                        {formatRelative(incident.occurredAt)}
                      </span>
                    }
                    accent={priority?.color}
                    status={<IncidentStatusBadge status={incident.status} />}
                    action={action ? <ActionLink item={action} /> : null}
                  />
                );
              })}
            </RecordList>
          )}
        </>
      )}
    </main>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading incidents…</main>}>
      <IncidentsBoard />
    </Suspense>
  );
}
