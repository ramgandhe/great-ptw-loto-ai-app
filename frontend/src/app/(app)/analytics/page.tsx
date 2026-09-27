"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { AnimatedNumber } from "@/components/analytics/animated-number";
import { ChartCard } from "@/components/analytics/chart-card";
import { Donut, RankedBars, SegmentedBar, StatTile, TrendArea } from "@/components/analytics/charts";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { INCIDENT_TYPES, PERIODS, PERMIT_STAGES, PRIORITIES, SEVERITIES } from "@/lib/analytics/labels";
import { getInsights } from "@/lib/dashboards/api";
import type { InsightsPayload } from "@/lib/dashboards/types";
import { formatRelative } from "@/lib/format";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

function hoursLabel(hours: number | null): string {
  if (hours === null) return "No decisions yet";
  if (hours < 1) return "Under an hour";
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((a, b) => a + b, 0);
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getInsights(days)
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Analytics could not be loaded. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [days, reloadKey]);

  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? `${days} days`;

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            What needs attention first, then how work, approvals and safety are trending.
            {data ? <span className="ml-2 text-xs">Updated {formatRelative(data.period.to)}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Period" className="flex rounded-lg border border-border bg-card p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                role="tab"
                aria-selected={days === p.days}
                onClick={() => setDays(p.days)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  days === p.days ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw aria-hidden />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!data ? (
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      ) : (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="flex flex-col gap-10">
          <Section title="Needs attention" description="Anything above zero here is waiting on someone.">
            <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <AttentionTile label="Work past planned end" value={data.attention.overdueActivePermits} href="/execution" tone="danger" />
              <AttentionTile label="Approvals waiting over a day" value={data.attention.approvalsWaitingOverDay} href="/approvals" tone="warning" />
              <AttentionTile label="High-severity SIMOPS clashes" value={data.attention.highSeverityConflicts} href="/simops/conflicts" tone="danger" />
              <AttentionTile label="Serious incidents open" value={data.attention.criticalIncidentsOpen} href="/incidents" tone="danger" />
              <AttentionTile label="Corrective actions overdue" value={data.attention.overdueCorrectiveActions} href="/incidents" tone="warning" />
              <AttentionTile label="Suspended permits" value={data.attention.suspendedPermits} href="/permits?stage=live" tone="warning" />
            </motion.div>
          </Section>

          <Section title="Permit activity" description={`Last ${periodLabel}.`}>
            <div className="grid gap-4 lg:grid-cols-5">
              <ChartCard
                className="lg:col-span-3"
                title="Raised and closed"
                insight={(() => {
                  const raised = data.permits.timeline.reduce((n, r) => n + r.raised, 0);
                  const closed = data.permits.timeline.reduce((n, r) => n + r.closed, 0);
                  return `${raised} raised and ${closed} closed. ${raised > closed ? "The open backlog grew." : "The backlog did not grow."}`;
                })()}
              >
                <TrendArea
                  data={data.permits.timeline}
                  series={[
                    { key: "raised", label: "Raised", color: "var(--accent-primary)" },
                    { key: "closed", label: "Closed", color: "var(--permit-active-bg)" },
                  ]}
                />
              </ChartCard>
              <ChartCard className="lg:col-span-2" title="Where permits stand now" insight="Every permit by lifecycle stage, in order.">
                <RankedBars
                  emptyMessage="No permits yet."
                  rows={PERMIT_STAGES.map((stage) => ({
                    key: stage.key,
                    label: stage.label,
                    color: stage.color,
                    count: data.permits.byStatus.find((s) => s.key === stage.key)?.count ?? 0,
                  })).filter((row) => row.count > 0)}
                />
              </ChartCard>
            </div>
          </Section>

          <Section title="Approvals" description="How quickly permits get a decision.">
            <div className="grid gap-4 md:grid-cols-3">
              <motion.div variants={staggerItem} className="grid gap-3">
                <StatTile
                  label="Typical time to a decision"
                  value={hoursLabel(data.approvals.medianHoursToDecision)}
                  hint={`Median of ${data.approvals.decided} decision${data.approvals.decided === 1 ? "" : "s"} in the period`}
                />
                <StatTile
                  label="Waiting now"
                  value={<AnimatedNumber value={data.approvals.waitingByAge.reduce((n, b) => n + b.count, 0)} />}
                  href="/approvals"
                  hint="Permits pending a decision"
                />
              </motion.div>
              <ChartCard title="How long pending permits have waited" insight="Anything over a day slows the site down." className="md:col-span-2">
                <SegmentedBar
                  emptyMessage="Nothing is waiting for approval."
                  segments={data.approvals.waitingByAge.map((b, i) => ({
                    key: b.key,
                    label: b.label ?? b.key,
                    count: b.count,
                    color: ["var(--permit-active-bg)", "var(--status-info)", "var(--status-warning)", "var(--status-danger)"][i],
                  }))}
                />
                {sum(data.approvals.decisions) > 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Decisions in the period:{" "}
                    {Object.entries(data.approvals.decisions)
                      .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
                      .join(", ")}
                    .
                  </p>
                ) : null}
              </ChartCard>
            </div>
          </Section>

          <Section title="Safety" description="Incidents, clashing work and follow-up actions.">
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="Incidents by type" insight={`${data.incidents.total} reported, ${data.incidents.open} still open.`}>
                <Donut
                  centreLabel="reported"
                  emptyMessage={`No incidents reported in the last ${periodLabel}.`}
                  segments={Object.entries(INCIDENT_TYPES).map(([key, meta]) => ({
                    key,
                    label: meta.label,
                    color: meta.color,
                    count: data.incidents.byType[key] ?? 0,
                  }))}
                />
              </ChartCard>
              <ChartCard title="Incidents by priority" insight="Critical and high need an investigator quickly.">
                <SegmentedBar
                  emptyMessage={`No incidents reported in the last ${periodLabel}.`}
                  segments={PRIORITIES.map((p) => ({ ...p, count: data.incidents.byPriority[p.key] ?? 0 }))}
                />
                <div className="mt-5">
                  <TrendArea
                    height={110}
                    data={data.incidents.timeline}
                    series={[{ key: "reported", label: "Reported", color: "var(--status-danger)" }]}
                  />
                </div>
              </ChartCard>
              <ChartCard
                title="SIMOPS clashes"
                insight={`${data.simops.open} open. Resolve high severity before work starts.`}
              >
                <SegmentedBar
                  emptyMessage="No clashing work detected."
                  segments={data.simops.bySeverity.map((s) => ({
                    key: s.key,
                    label: SEVERITIES[s.key]?.label ?? s.key,
                    count: s.open,
                    color: SEVERITIES[s.key]?.color ?? "var(--muted-foreground)",
                  }))}
                />
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <MiniFigure label="Actions open" value={data.actions.open} />
                  <MiniFigure label="Overdue" value={data.actions.overdue} alert={data.actions.overdue > 0} />
                  <MiniFigure label="Completed" value={data.actions.completed} />
                </div>
              </ChartCard>
            </div>
          </Section>

          <Section title="Where the work is" description={`Permits raised in the last ${periodLabel}, and live work by place.`}>
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="By permit type" insight={data.permits.byType[0] ? `${data.permits.byType[0].label} is the most common.` : undefined}>
                <RankedBars
                  emptyMessage="No permits raised in this period."
                  rows={data.permits.byType.map((r) => ({ key: r.key, label: r.label ?? "Unknown", count: r.count, color: r.color }))}
                />
              </ChartCard>
              <ChartCard title="By department">
                <RankedBars
                  emptyMessage="No permits raised in this period."
                  rows={data.permits.byDepartment.map((r) => ({ key: r.key, label: r.label ?? "Unknown", count: r.count }))}
                />
              </ChartCard>
              <ChartCard title="Busiest places now" insight="Live permits by machine or location. Clusters raise clash risk.">
                <RankedBars
                  emptyMessage="No live permits."
                  rows={data.permits.hotspots.map((r) => ({ key: r.key, label: r.label ?? "Unknown", count: r.count, color: "var(--vivid-4)" }))}
                />
              </ChartCard>
            </div>
          </Section>
        </motion.div>
      )}
    </main>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-4">
      <motion.div variants={staggerItem}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </motion.div>
      {children}
    </section>
  );
}

function AttentionTile({ label, value, href, tone }: { label: string; value: number; href: string; tone: "warning" | "danger" }) {
  return (
    <StatTile
      label={label}
      value={<AnimatedNumber value={value} />}
      href={href}
      tone={value > 0 ? tone : "neutral"}
      hint={value > 0 ? "Open to act" : "All clear"}
    />
  );
}

function MiniFigure({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-2">
      <p className={cn("font-heading text-xl font-bold tabular-nums", alert ? "text-(--status-danger)" : "")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
