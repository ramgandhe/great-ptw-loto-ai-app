"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckSquare,
  ClipboardList,
  Lock,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { listPendingApprovals } from "@/lib/approval/api";
import { listArchivedPermits } from "@/lib/closure/api";
import { listLototoPlans } from "@/lib/lototo/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { Icon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

type Kpi = {
  label: string;
  value: string | number;
  description: string;
  href?: string;
  tone?: string;
  available?: boolean;
};

function countByStatus(permits: PermitRecord[], status: string) {
  return permits.filter((permit) => permit.status === status).length;
}

export default function DashboardPage() {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [lototoPlans, setLototoPlans] = useState(0);
  const [lototoInExecution, setLototoInExecution] = useState(0);
  const [archived, setArchived] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    Promise.all([
      listPermits(),
      listPendingApprovals(),
      listLototoPlans(),
      listArchivedPermits(),
    ])
      .then(([permitRows, approvals, plans, archiveRows]) => {
        setPermits(permitRows);
        setPendingApprovals(approvals.length);
        setLototoPlans(plans.length);
        setLototoInExecution(plans.filter((plan) => plan.status === "in_execution").length);
        setArchived(archiveRows.length);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Failed to load dashboard analytics");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const draft = countByStatus(permits, "draft");
    const pendingApproval = countByStatus(permits, "pending_approval");
    const approved = countByStatus(permits, "approved");
    const active = countByStatus(permits, "active");
    const suspended = countByStatus(permits, "suspended");
    const pendingClosure = countByStatus(permits, "pending_closure");
    const closed = countByStatus(permits, "closed");
    const rejected = countByStatus(permits, "rejected");
    const deferred = countByStatus(permits, "deferred");
    const expired = countByStatus(permits, "expired");
    const inWorkflow = permits.filter((permit) =>
      ["pending_approval", "approved", "active", "suspended", "pending_closure"].includes(
        permit.status,
      ),
    ).length;

    return {
      draft,
      pendingApproval,
      approved,
      active,
      suspended,
      pendingClosure,
      closed,
      rejected,
      deferred,
      expired,
      inWorkflow,
      total: permits.length,
    };
  }, [permits]);

  const kpis: Kpi[] = [
    {
      label: "Active permits",
      value: isLoading ? "—" : metrics.active,
      description: "Work in progress on site",
      href: "/execution",
      tone: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Pending approvals",
      value: isLoading ? "—" : pendingApprovals || metrics.pendingApproval,
      description: "Awaiting review decision",
      href: "/approvals",
      tone: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "Suspended",
      value: isLoading ? "—" : metrics.suspended,
      description: "Paused execution",
      href: "/execution",
      tone: "text-orange-700 dark:text-orange-300",
    },
    {
      label: "Closed / archived",
      value: isLoading ? "—" : Math.max(metrics.closed, archived),
      description: "Completed permit records",
      href: "/closure/archive",
      tone: "text-slate-700 dark:text-slate-300",
    },
    {
      label: "LOTOTO plans",
      value: isLoading ? "—" : lototoPlans,
      description: `${isLoading ? "—" : lototoInExecution} in isolation execution`,
      href: "/lototo",
      tone: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "SIMOPS conflicts",
      value: "N/A",
      description: "SIMOPS analytics arrive in MS-04",
      available: false,
      tone: "text-muted-foreground",
    },
  ];

  const lifecycle = [
    { label: "Draft", count: metrics.draft, href: "/permits/drafts" },
    { label: "Pending approval", count: metrics.pendingApproval, href: "/approvals" },
    { label: "Approved", count: metrics.approved, href: "/execution" },
    { label: "Active", count: metrics.active, href: "/execution" },
    { label: "Suspended", count: metrics.suspended, href: "/execution" },
    { label: "Pending closure", count: metrics.pendingClosure, href: "/closure" },
    { label: "Closed", count: metrics.closed, href: "/closure/archive" },
    { label: "Deferred", count: metrics.deferred, href: "/approvals/deferred" },
    { label: "Rejected", count: metrics.rejected, href: "/permits" },
    { label: "Expired", count: metrics.expired, href: "/permits" },
  ];

  const maxLifecycle = Math.max(1, ...lifecycle.map((item) => item.count));

  const shortcuts = [
    { href: "/permits/new", label: "Create permit", icon: ClipboardList },
    { href: "/approvals", label: "Review approvals", icon: CheckSquare },
    { href: "/execution", label: "Monitor execution", icon: Activity },
    { href: "/lototo", label: "LOTOTO plans", icon: LockKeyhole },
    { href: "/closure", label: "Close permits", icon: Lock },
    { href: "/safety", label: "Safety hub", icon: ShieldAlert },
  ];

  return (
    <FadeIn className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live workflow analytics across permits, approvals, execution, LOTOTO and closure.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : `${metrics.total} permits · ${metrics.inWorkflow} in workflow`}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <section aria-label="Key performance indicators" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => {
          const content = (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </p>
              <p className={cn("mt-2 text-3xl font-semibold", kpi.tone)}>{kpi.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{kpi.description}</p>
            </>
          );

          if (kpi.href && kpi.available !== false) {
            return (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={kpi.label}
              className="rounded-lg border border-dashed border-border bg-card/60 p-4"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">{content}</div>
              </div>
            </div>
          );
        })}
      </section>

      <section aria-label="Permit lifecycle breakdown" className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold">Permit lifecycle</h2>
          <p className="text-sm text-muted-foreground">
            Status distribution across the full permit-to-work workflow.
          </p>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading lifecycle counts…</p>
        ) : (
          <ul className="grid gap-3">
            {lifecycle.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="group grid gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground group-hover:underline">{item.label}</span>
                    <span className="font-medium tabular-nums">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80 transition-[width]"
                      style={{ width: `${(item.count / maxLifecycle) * 100}%` }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Workflow shortcuts">
        <h2 className="mb-3 text-sm font-semibold">Jump to workflow</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
