"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Radar } from "lucide-react";
import { AnimatedNumber } from "@/components/analytics/animated-number";
import { StatTile } from "@/components/analytics/charts";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorNote, RecordList, RecordRow } from "@/components/safety/record-list";
import { ConflictSeverityBadge } from "@/components/simops/conflict-severity-badge";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { MultiToggle, SegmentedToggle } from "@/components/ui/toggle-group";
import { ActionButtonLink } from "@/components/work/action-link";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { SIMOPS_ANALYSE_ROLES } from "@/lib/auth/roles";
import { formatDateTime, formatRelative } from "@/lib/format";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { CONFLICT_STATUS, SEVERITY, toneOf } from "@/lib/safety/status";
import { analyseSimopsConflicts, listSimopsConflicts, listSimopsHistory } from "@/lib/simops/api";
import type { HistoryListItem, SimopsConflict } from "@/lib/simops/types";

const TYPE_LABELS: Record<string, string> = { location: "Same location", equipment: "Same equipment", schedule: "Same time window", permit_type: "Incompatible permit types" };
const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const list = (value: string | null) => (value ?? "").split(",").filter(Boolean);

function SimopsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { roles } = useAuthProfile();
  const canAnalyse = hasAnyRole(roles, SIMOPS_ANALYSE_ROLES);
  const view = params.get("view") === "history" ? "history" : "active";
  const severities = list(params.get("severity"));
  const types = list(params.get("type"));

  const [conflicts, setConflicts] = useState<SimopsConflict[] | null>(null);
  const [history, setHistory] = useState<HistoryListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  function setParams(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  const load = () =>
    Promise.all([listSimopsConflicts(), listSimopsHistory()]).then(([rows, done]) => {
      setConflicts(rows.filter((c) => c.status !== "approved" && c.status !== "rejected"));
      setHistory(done);
    });

  useEffect(() => {
    Promise.all([listSimopsConflicts(), listSimopsHistory()])
      .then(([rows, done]) => {
        setConflicts(rows.filter((c) => c.status !== "approved" && c.status !== "rejected"));
        setHistory(done);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "SIMOPS could not be loaded. Try again."));
  }, []);

  async function analyse() {
    setAnalysing(true);
    setError(null);
    try {
      await analyseSimopsConflicts();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The clash check failed. Try again.");
    } finally {
      setAnalysing(false);
    }
  }

  const open = conflicts ?? [];
  const source = view === "active" ? open : history.map((h) => h.conflict);
  const matches = (c: SimopsConflict) => (severities.length === 0 || severities.includes(c.severity)) && (types.length === 0 || types.includes(c.conflictType));
  const resolutionOf = new Map(history.map((h) => [h.conflict.id, h.resolution]));
  const rows = source
    .filter(matches)
    .sort((a, b) => (view === "active" ? (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) : 0) || b.detectedAt.localeCompare(a.detectedAt));

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        title="SIMOPS"
        description="Overlapping work on the same location, workstation, or machinery. HOD decides each permit in the case."
        actions={
          canAnalyse ? (
            <Button type="button" size="lg" onClick={analyse} disabled={analysing}>
              <Radar aria-hidden />
              {analysing ? "Checking…" : "Check for clashes"}
            </Button>
          ) : null
        }
      >
        <SegmentedToggle
          label="View"
          value={view}
          onChange={(v) => setParams({ view: v === "active" ? "" : v })}
          options={[
            { value: "active", label: "Needs resolving", count: open.length },
            { value: "history", label: "Resolved", count: history.length },
          ]}
          className="self-start"
        />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <MultiToggle
            label="Severity"
            selected={severities}
            onChange={(next) => setParams({ severity: next.join(",") })}
            options={Object.entries(SEVERITY).map(([key, tone]) => ({ value: key, label: tone.label, color: tone.color, count: source.filter((c) => c.severity === key).length }))}
          />
          <MultiToggle
            label="Clash type"
            selected={types}
            onChange={(next) => setParams({ type: next.join(",") })}
            options={Object.entries(TYPE_LABELS)
              .map(([key, label]) => ({ value: key, label, count: source.filter((c) => c.conflictType === key).length }))
              .filter((o) => o.count > 0 || types.includes(o.value))}
          />
        </div>

        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { label: "Open cases", value: open.length, tone: "warning" as const, href: "/simops" },
            { label: "High severity", value: open.filter((c) => c.severity === "high").length, tone: "danger" as const, href: "/simops?severity=high" },
            { label: "Needs HOD", value: open.filter((c) => c.status === "open").length, tone: "warning" as const, href: "/simops" },
            { label: "Resolved", value: history.length, href: "/simops?view=history" },
          ].map((t) => (
            <motion.div key={t.label} variants={staggerItem}>
              <StatTile compact label={t.label} value={<AnimatedNumber value={t.value} />} href={t.href} tone={t.tone && t.value > 0 ? t.tone : "neutral"} />
            </motion.div>
          ))}
        </motion.div>
      </PageHeader>

      <ErrorNote message={error} />

      {conflicts === null ? (
        <p className="text-sm text-muted-foreground">Loading clashes…</p>
      ) : (
        <>

          {rows.length === 0 ? (
            <EmptyState
              title={view === "active" ? "No open clashes match" : "No resolved clashes match"}
              hint={view === "active" && open.length === 0 ? "Cases appear when an issuer submits overlapping work." : "Remove a filter above to widen the list."}
            />
          ) : (
            <RecordList headers={["Clash", view === "active" ? "Detected" : "Outcome", "Status", view === "active" ? "Next step" : ""]}>
              {rows.map((c, i) => {
                const resolution = resolutionOf.get(c.id);
                return (
                  <RecordRow
                    key={c.id}
                    index={i}
                    href={view === "active" ? `/simops/conflicts/${c.id}` : `/simops/history/${c.id}`}
                    title={c.summary}
                    meta={<span>{TYPE_LABELS[c.conflictType] ?? c.conflictType}</span>}
                    context={
                      resolution ? (
                        <span>
                          <span className="font-medium text-foreground">{resolution.outcome === "approved" ? "Allowed with controls" : "Stopped"}</span>
                          <br />
                          {formatDateTime(resolution.resolvedAt)}
                        </span>
                      ) : (
                        formatRelative(c.detectedAt)
                      )
                    }
                    accent={toneOf(SEVERITY, c.severity).color}
                    status={
                      <span className="flex flex-col items-start gap-1">
                        <ConflictSeverityBadge severity={c.severity} />
                        <StatusChip {...toneOf(CONFLICT_STATUS, c.status)} />
                      </span>
                    }
                    action={
                      view === "active" && canAnalyse ? (
                        <ActionButtonLink href={`/simops/conflicts/${c.id}`} kind="fix" urgent={c.severity === "high"}>
                          Resolve
                        </ActionButtonLink>
                      ) : null
                    }
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

export default function SimopsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading SIMOPS…</main>}>
      <SimopsBoard />
    </Suspense>
  );
}
