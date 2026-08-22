"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckSquare,
  ClipboardList,
  FileText,
  Lock,
  LockKeyhole,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import {
  DASHBOARD_ANALYTICS_ROLES,
  DASHBOARD_REPORT_ROLES,
  NAV_APPROVALS_ROLES,
  NAV_CLOSURE_ROLES,
  NAV_EXECUTION_ROLES,
  NAV_LOTOTO_ROLES,
  PERMIT_WRITE_ROLES,
} from "@/lib/auth/roles";
import { getDashboard } from "@/lib/dashboards/api";
import { getAllowedDashboardKinds, resolveDashboardKind } from "@/lib/dashboards/kinds";
import type { DashboardKind, DashboardPayload } from "@/lib/dashboards/types";
import { DashboardKindSelector } from "@/components/dashboards/dashboard-kind-selector";
import { DashboardNotificationsPanel } from "@/components/dashboards/dashboard-notifications-panel";
import { KpiGrid } from "@/components/dashboards/kpi-grid";
import { Icon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";

const SHORTCUTS: { href: string; label: string; icon: LucideIcon; roles: readonly string[] }[] = [
  { href: "/permits/new", label: "Create permit", icon: ClipboardList, roles: PERMIT_WRITE_ROLES },
  { href: "/approvals", label: "Review approvals", icon: CheckSquare, roles: NAV_APPROVALS_ROLES },
  { href: "/execution", label: "Monitor execution", icon: Activity, roles: NAV_EXECUTION_ROLES },
  { href: "/lototo", label: "LOTOTO plans", icon: LockKeyhole, roles: NAV_LOTOTO_ROLES },
  { href: "/closure", label: "Close permits", icon: Lock, roles: NAV_CLOSURE_ROLES },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: DASHBOARD_ANALYTICS_ROLES },
  { href: "/reports", label: "Reports", icon: FileText, roles: DASHBOARD_REPORT_ROLES },
];

export default function DashboardPage() {
  const { roles } = useAuthProfile();
  const allowedKinds = useMemo(() => getAllowedDashboardKinds(roles), [roles]);
  const defaultKind = useMemo(() => resolveDashboardKind(roles), [roles]);
  const [kind, setKind] = useState<DashboardKind>(defaultKind);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const shortcuts = useMemo(
    () => SHORTCUTS.filter((item) => hasAnyRole(roles, item.roles)),
    [roles],
  );

  useEffect(() => {
    setKind(defaultKind);
  }, [defaultKind]);

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
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            KPIs and operational summary from the platform analytics service.
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

      <DashboardKindSelector value={kind} allowedKinds={allowedKinds} onChange={setKind} />

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
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          </dl>
        ) : null}
      </section>

      <section aria-label="Key performance indicators">
        <h2 className="mb-3 text-sm font-semibold">KPIs</h2>
        <KpiGrid items={dashboard?.kpis.items ?? []} isLoading={isLoading} />
      </section>

      <DashboardNotificationsPanel />

      {shortcuts.length > 0 ? (
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
      ) : null}
    </FadeIn>
  );
}
