"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckSquare,
  ClipboardList,
  FileText,
  Lock,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { getDashboard } from "@/lib/dashboards/api";
import { DASHBOARD_KIND_LABELS } from "@/lib/dashboards/labels";
import type { DashboardKind, DashboardPayload } from "@/lib/dashboards/types";
import { DashboardKindSelector } from "@/components/dashboards/dashboard-kind-selector";
import { KpiGrid } from "@/components/dashboards/kpi-grid";
import { Icon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";

const shortcuts = [
  { href: "/permits/new", label: "Create permit", icon: ClipboardList },
  { href: "/approvals", label: "Review approvals", icon: CheckSquare },
  { href: "/execution", label: "Monitor execution", icon: Activity },
  { href: "/lototo", label: "LOTOTO plans", icon: LockKeyhole },
  { href: "/closure", label: "Close permits", icon: Lock },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/safety", label: "Safety hub", icon: ShieldAlert },
];

export default function DashboardPage() {
  const [kind, setKind] = useState<DashboardKind>("personal");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(() => {
    setIsLoading(true);
    setError(null);

    getDashboard(kind)
      .then(setDashboard)
      .catch((err) => {
        setDashboard(null);
        setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
      })
      .finally(() => setIsLoading(false));
  }, [kind]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <FadeIn className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{DASHBOARD_KIND_LABELS[kind]} dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role-based KPIs and operational summary from the platform analytics service.
          </p>
          {dashboard?.refreshedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Refreshed {new Date(dashboard.refreshedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={loadDashboard} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      <DashboardKindSelector value={kind} onChange={setKind} />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <section aria-label="Summary">
        <h2 className="mb-3 text-sm font-semibold">Summary</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading summary…</p>
        ) : dashboard ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {dashboard.summary.myOpenPermits !== undefined ? (
              <div className="rounded-lg border border-border bg-card p-4">
                <dt className="text-xs text-muted-foreground">My open permits</dt>
                <dd className="mt-1 text-2xl font-semibold">{dashboard.summary.myOpenPermits}</dd>
              </div>
            ) : null}
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="text-xs text-muted-foreground">Active permits</dt>
              <dd className="mt-1 text-2xl font-semibold">{dashboard.summary.activePermits ?? 0}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="text-xs text-muted-foreground">Pending approvals</dt>
              <dd className="mt-1 text-2xl font-semibold">{dashboard.summary.pendingApprovals ?? 0}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="text-xs text-muted-foreground">Open incidents</dt>
              <dd className="mt-1 text-2xl font-semibold">{dashboard.summary.openIncidents ?? 0}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="text-xs text-muted-foreground">Open SIMOPS conflicts</dt>
              <dd className="mt-1 text-2xl font-semibold">
                {dashboard.summary.openSimopsConflicts ?? 0}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <dt className="text-xs text-muted-foreground">Active LOTOTO executions</dt>
              <dd className="mt-1 text-2xl font-semibold">
                {dashboard.summary.activeLototoExecutions ?? 0}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section aria-label="Key performance indicators">
        <h2 className="mb-3 text-sm font-semibold">KPIs</h2>
        <KpiGrid items={dashboard?.kpis.items ?? []} isLoading={isLoading} />
      </section>

      <section aria-label="Workflow shortcuts">
        <h2 className="mb-3 text-sm font-semibold">Jump to workflow</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <Icon icon={item.icon} size="sm" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </FadeIn>
  );
}
