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
  RefreshCw,
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
import { TenantName } from "@/components/organisation/tenant-name";
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
    <FadeIn className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-6 xl:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <TenantName className="mt-1 text-sm font-medium text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            KPIs and operational summary for this organisation.
          </p>
          {dashboard?.refreshedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Refreshed {new Date(dashboard.refreshedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={loadDashboard} disabled={isLoading}>
          <RefreshCw
            aria-hidden="true"
            className={isLoading ? "animate-spin motion-reduce:animate-none" : undefined}
          />
          Refresh
        </Button>
      </div>

      <DashboardKindSelector value={kind} allowedKinds={allowedKinds} onChange={setKind} />

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <section aria-label="Summary">
        <h2 className="mb-3 text-sm font-semibold">Summary</h2>
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading summary"
            className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4"
          >
            {[0, 1, 2, 3].map((placeholderIndex) => (
              <div key={placeholderIndex} className="space-y-3 bg-card p-4 sm:p-5">
                <div className="h-3 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="h-8 w-14 animate-pulse rounded bg-muted motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        ) : dashboard ? (
          <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {dashboard.summary.myOpenPermits !== undefined ? (
              <div className="bg-card p-4 sm:p-5">
                <dt className="text-xs font-medium text-muted-foreground">My open permits</dt>
                <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums">
                  {dashboard.summary.myOpenPermits}
                </dd>
              </div>
            ) : null}
            <div className="bg-card p-4 sm:p-5">
              <dt className="text-xs font-medium text-muted-foreground">Active permits</dt>
              <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums">
                {dashboard.summary.activePermits ?? 0}
              </dd>
            </div>
            <div className="bg-card p-4 sm:p-5">
              <dt className="text-xs font-medium text-muted-foreground">Pending approvals</dt>
              <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums">
                {dashboard.summary.pendingApprovals ?? 0}
              </dd>
            </div>
            <div className="bg-card p-4 sm:p-5">
              <dt className="text-xs font-medium text-muted-foreground">Open incidents</dt>
              <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums">
                {dashboard.summary.openIncidents ?? 0}
              </dd>
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
                className="flex min-h-14 items-center gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
