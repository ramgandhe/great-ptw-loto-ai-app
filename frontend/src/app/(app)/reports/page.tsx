"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { AnimatedNumber } from "@/components/analytics/animated-number";
import { ChartCard } from "@/components/analytics/chart-card";
import { RankedBars, SegmentedBar, StatTile } from "@/components/analytics/charts";
import { PageHeader } from "@/components/layout/page-header";
import { PermitTypeChip } from "@/components/permit/permit-type-chip";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { MultiToggle, SegmentedToggle } from "@/components/ui/toggle-group";
import { ApiError } from "@/lib/api";
import { INCIDENT_TYPES, PERIODS, PERMIT_STAGES, PRIORITIES } from "@/lib/analytics/labels";
import { getInsights, getReportView } from "@/lib/dashboards/api";
import type { IncidentReportRow, InsightsPayload, PermitReportRow } from "@/lib/dashboards/types";
import { formatDateTime, formatStatus, formatWindow } from "@/lib/format";
import { staggerContainer, staggerItem } from "@/lib/motion";

const TABS = [
  { key: "permits", label: "Permit register" },
  { key: "incidents", label: "Incident register" },
  { key: "summary", label: "Operational summary" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type SortState = { column: string; dir: "asc" | "desc" };

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function SortHeader({ column, label, sort, onSort }: { column: string; label: string; sort: SortState; onSort: (c: string) => void }) {
  const active = sort.column === column;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-2.5 font-semibold">
      <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {active ? sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : null}
      </button>
    </th>
  );
}

function ReportsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (params.get("tab") as TabKey | null) ?? "permits";
  const days = Number(params.get("days") ?? 90);
  const [query, setQuery] = useState(params.get("q") ?? "");
  // Several stages (or priorities) can be picked at once; none picked means all.
  const filter = (params.get("filter") ?? "").split(",").filter(Boolean);
  const [sort, setSort] = useState<SortState>({ column: "date", dir: "desc" });
  const [permitRows, setPermitRows] = useState<PermitReportRow[] | null>(null);
  const [incidentRows, setIncidentRows] = useState<IncidentReportRow[] | null>(null);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setParams(next: Record<string, string>) {
    // Tabs and periods are view state; keep the scroll position.
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all") search.set(key, value);
      else search.delete(key);
    }
    router.replace(`${pathname}${search.size ? `?${search}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    const done = (fn: () => void) => !cancelled && fn();
    const fail = (err: unknown) =>
      done(() => setError(err instanceof ApiError ? err.message : "This report could not be loaded. Try again."));
    if (tab === "permits") {
      getReportView<PermitReportRow>("permit_summary", days).then((r) => done(() => { setPermitRows(r.rows); setError(null); }), fail);
    } else if (tab === "incidents") {
      getReportView<IncidentReportRow>("incident_summary", days).then((r) => done(() => { setIncidentRows(r.rows); setError(null); }), fail);
    } else {
      getInsights(days).then((r) => done(() => { setInsights(r); setError(null); }), fail);
    }
    return () => {
      cancelled = true;
    };
  }, [tab, days]);

  function onSort(column: string) {
    setSort((s) => ({ column, dir: s.column === column && s.dir === "desc" ? "asc" : "desc" }));
  }

  const permitView = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (permitRows ?? []).filter(
      (r) =>
        (filter.length === 0 || filter.includes(r.status)) &&
        (!q || [r.reference, r.title, r.type, r.place, r.department].some((v) => v?.toLowerCase().includes(q))),
    );
    const key = (r: PermitReportRow) =>
      sort.column === "date" ? r.createdAt : sort.column === "start" ? r.plannedStartAt : (r as Record<string, unknown>)[sort.column];
    return [...rows].sort((a, b) => compare(key(a), key(b)) * (sort.dir === "asc" ? 1 : -1));
  }, [permitRows, query, filter, sort]);

  const incidentView = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (incidentRows ?? []).filter(
      (r) =>
        (filter.length === 0 || filter.includes(r.priority)) &&
        (!q || [r.reference, r.title, r.place, INCIDENT_TYPES[r.type]?.label].some((v) => v?.toLowerCase().includes(q))),
    );
    const key = (r: IncidentReportRow) => (sort.column === "date" ? r.occurredAt : (r as Record<string, unknown>)[sort.column]);
    return [...rows].sort((a, b) => compare(key(a), key(b)) * (sort.dir === "asc" ? 1 : -1));
  }, [incidentRows, query, filter, sort]);

  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? `${days} days`;

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        title="Reports"
        description="Registers and summaries. Filter, sort and open any record straight from the report."
        actions={
          <SegmentedToggle
            label="Period"
            value={days}
            onChange={(d) => setParams({ days: String(d) })}
            options={PERIODS.map((p) => ({ value: p.days, label: p.label }))}
          />
        }
      >
        <SegmentedToggle
          label="Report"
          value={tab}
          onChange={(key) => {
            setQuery("");
            setParams({ tab: key, filter: "", q: "" });
          }}
          options={TABS.map((t) => ({ value: t.key, label: t.label }))}
          className="self-start"
        />
        {tab !== "summary" ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex h-10 w-full items-center sm:w-80">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
              <span className="sr-only">Search the report</span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setParams({ q: e.target.value });
                }}
                placeholder={tab === "permits" ? "Reference, title, type, place" : "Reference, title, place"}
                className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <MultiToggle
              label={tab === "permits" ? "Status" : "Priority"}
              selected={filter}
              onChange={(next) => setParams({ filter: next.join(",") })}
              options={(tab === "permits" ? PERMIT_STAGES : PRIORITIES)
                .map((o) => ({
                  value: o.key,
                  label: o.label,
                  color: o.color,
                  count:
                    tab === "permits"
                      ? (permitRows ?? []).filter((r) => r.status === o.key).length
                      : (incidentRows ?? []).filter((r) => r.priority === o.key).length,
                }))
                .filter((o) => o.count > 0 || filter.includes(o.value))}
            />
          </div>
        ) : null}
      </PageHeader>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {tab === "permits" ? (
        permitRows === null ? (
          <p className="text-sm text-muted-foreground">Loading report…</p>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-5">
            <motion.div variants={staggerItem} className="grid gap-3 md:grid-cols-[14rem_1fr]">
              <StatTile label={`Permits in the last ${periodLabel}`} value={<AnimatedNumber value={permitView.length} />} hint={filter.length > 0 || query ? "Matching your filters" : undefined} />
              <div className="rounded-xl border border-border bg-card px-5 py-4">
                <SegmentedBar
                  emptyMessage="No permits match."
                  segments={PERMIT_STAGES.map((s) => ({ ...s, count: permitView.filter((r) => r.status === s.key).length })).filter((s) => s.count > 0)}
                />
              </div>
            </motion.div>
            <motion.div variants={staggerItem} className="relative overflow-x-auto rounded-xl border border-border bg-card">
              {permitView.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">No permits match. Widen the period or clear the filters.</p>
              ) : (
                <>
                <ul className="divide-y divide-border md:hidden">
                  {permitView.map((r) => (
                    <li key={r.id} className="relative px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/permits/${r.id}`} className="font-medium after:absolute after:inset-0">
                          {r.title}
                        </Link>
                        <PermitStatusBadge status={r.status} />
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span className="rounded-md bg-muted px-1.5 font-mono font-semibold text-foreground">{r.reference ?? "Draft"}</span>
                        {r.type ? <PermitTypeChip name={r.type} color={r.typeColor} className="py-0" /> : null}
                        {r.place ? <span>{r.place}</span> : null}
                        <span>{formatWindow(r.plannedStartAt, r.plannedEndAt)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
                <table className="hidden min-w-[56rem] w-full text-left text-sm md:table">
                  <caption className="sr-only">Permit register, last {periodLabel}</caption>
                  <thead className="table-tone text-xs">
                    <tr className="border-b border-border">
                      <SortHeader column="reference" label="Reference" sort={sort} onSort={onSort} />
                      <SortHeader column="title" label="Permit" sort={sort} onSort={onSort} />
                      <SortHeader column="type" label="Type" sort={sort} onSort={onSort} />
                      <SortHeader column="place" label="Place" sort={sort} onSort={onSort} />
                      <SortHeader column="start" label="Planned" sort={sort} onSort={onSort} />
                      <SortHeader column="status" label="Status" sort={sort} onSort={onSort} />
                      <SortHeader column="date" label="Raised" sort={sort} onSort={onSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {permitView.map((r) => (
                      <tr key={r.id} className="row-hover relative border-t border-border first:border-t-0">
                        <td className="whitespace-nowrap px-4 py-3"><span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">{r.reference ?? "Draft"}</span></td>
                        <td className="px-4 py-3">
                          <Link href={`/permits/${r.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                            {r.title}
                          </Link>
                          {r.department ? <p className="text-xs text-muted-foreground">{r.department}</p> : null}
                        </td>
                        <td className="px-4 py-3">
                          <PermitTypeChip name={r.type ?? "Not set"} color={r.typeColor} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.place ?? "Not set"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatWindow(r.plannedStartAt, r.plannedEndAt)}</td>
                        <td className="px-4 py-3">
                          <PermitStatusBadge status={r.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}
            </motion.div>
          </motion.div>
        )
      ) : null}

      {tab === "incidents" ? (
        incidentRows === null ? (
          <p className="text-sm text-muted-foreground">Loading report…</p>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-5">
            <motion.div variants={staggerItem} className="grid gap-3 md:grid-cols-[14rem_1fr]">
              <StatTile label={`Incidents in the last ${periodLabel}`} value={<AnimatedNumber value={incidentView.length} />} />
              <div className="rounded-xl border border-border bg-card px-5 py-4">
                <SegmentedBar
                  emptyMessage="No incidents match."
                  segments={PRIORITIES.map((p) => ({ ...p, count: incidentView.filter((r) => r.priority === p.key).length }))}
                />
              </div>
            </motion.div>
            <motion.div variants={staggerItem} className="relative overflow-x-auto rounded-xl border border-border bg-card">
              {incidentView.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No incidents in the last {periodLabel}. Widen the period to see older records.
                </p>
              ) : (
                <>
                <ul className="divide-y divide-border md:hidden">
                  {incidentView.map((r) => (
                    <li key={r.id} className="relative px-4 py-3">
                      <Link href={`/incidents/${r.id}`} className="font-medium after:absolute after:inset-0">
                        {r.title}
                      </Link>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span className="rounded-md bg-muted px-1.5 font-mono font-semibold text-foreground">{r.reference}</span>
                        <span>{INCIDENT_TYPES[r.type]?.label ?? formatStatus(r.type)}</span>
                        <span>{formatStatus(r.priority)} priority</span>
                        <span>{formatStatus(r.status)}</span>
                        <span>{formatDateTime(r.occurredAt)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
                <table className="hidden min-w-[48rem] w-full text-left text-sm md:table">
                  <caption className="sr-only">Incident register, last {periodLabel}</caption>
                  <thead className="table-tone text-xs">
                    <tr className="border-b border-border">
                      <SortHeader column="reference" label="Reference" sort={sort} onSort={onSort} />
                      <SortHeader column="title" label="Incident" sort={sort} onSort={onSort} />
                      <SortHeader column="type" label="Type" sort={sort} onSort={onSort} />
                      <SortHeader column="priority" label="Priority" sort={sort} onSort={onSort} />
                      <SortHeader column="status" label="Status" sort={sort} onSort={onSort} />
                      <SortHeader column="date" label="Occurred" sort={sort} onSort={onSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {incidentView.map((r) => (
                      <tr key={r.id} className="row-hover relative border-t border-border first:border-t-0">
                        <td className="whitespace-nowrap px-4 py-3"><span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">{r.reference}</span></td>
                        <td className="px-4 py-3">
                          <Link href={`/incidents/${r.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                            {r.title}
                          </Link>
                          {r.place ? <p className="text-xs text-muted-foreground">{r.place}</p> : null}
                        </td>
                        <td className="px-4 py-3">{INCIDENT_TYPES[r.type]?.label ?? formatStatus(r.type)}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: PRIORITIES.find((p) => p.key === r.priority)?.color }} />
                            {formatStatus(r.priority)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatStatus(r.status)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(r.occurredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}
            </motion.div>
          </motion.div>
        )
      ) : null}

      {tab === "summary" ? (
        insights === null ? (
          <p className="text-sm text-muted-foreground">Loading summary…</p>
        ) : (
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ChartCard title="Permits by stage" insight="Current position of every permit.">
              <RankedBars
                emptyMessage="No permits."
                rows={PERMIT_STAGES.map((s) => ({ key: s.key, label: s.label, color: s.color, count: insights.permits.byStatus.find((b) => b.key === s.key)?.count ?? 0 })).filter((r) => r.count > 0)}
              />
            </ChartCard>
            <ChartCard title="Permits by type" insight={`Raised in the last ${periodLabel}.`}>
              <RankedBars emptyMessage="No permits raised." rows={insights.permits.byType.map((r) => ({ key: r.key, label: r.label ?? "Unknown", count: r.count, color: r.color }))} />
            </ChartCard>
            <ChartCard title="Safety follow-up">
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Incidents open" value={insights.incidents.open} tone={insights.incidents.open > 0 ? "warning" : "neutral"} href="/reports?tab=incidents" />
                <StatTile label="SIMOPS clashes open" value={insights.simops.open} tone={insights.simops.open > 0 ? "danger" : "neutral"} href="/simops/conflicts" />
                <StatTile label="Actions overdue" value={insights.actions.overdue} tone={insights.actions.overdue > 0 ? "danger" : "neutral"} />
                <StatTile label="Approvals waiting over a day" value={insights.attention.approvalsWaitingOverDay} tone={insights.attention.approvalsWaitingOverDay > 0 ? "warning" : "neutral"} href="/approvals" />
              </div>
            </ChartCard>
          </motion.div>
        )
      ) : null}
    </main>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading reports…</main>}>
      <ReportsView />
    </Suspense>
  );
}
