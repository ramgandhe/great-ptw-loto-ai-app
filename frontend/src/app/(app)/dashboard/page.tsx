"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, FilePlus2, Siren } from "lucide-react";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import {
  DASHBOARD_ANALYTICS_ROLES,
  INCIDENT_REPORT_ROLES,
  PERMIT_CREATE_ROLES,
} from "@/lib/auth/roles";
import { buttonVariants } from "@/components/ui/button";
import { HomeInsights } from "@/components/work/home-insights";
import { WorkQueuePanel } from "@/components/work/work-queue-panel";
import { useWorkQueue } from "@/lib/work-queue-context";

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Home: the site figures (for managers) and what needs you, above the fold. */
export default function DashboardPage() {
  const { roles, profile } = useAuthProfile();
  const { items, permits, loaded, failed } = useWorkQueue();
  const canCreate = hasAnyRole(roles, PERMIT_CREATE_ROLES);
  const canReport = hasAnyRole(roles, INCIDENT_REPORT_ROLES);
  const canViewAnalytics = hasAnyRole(roles, DASHBOARD_ANALYTICS_ROLES);
  const firstName =
    profile?.firstName || profile?.displayName?.split(" ")[0] || "";
  const activePermits = permits.filter(
    (permit) => permit.status === "active",
  ).length;
  const awaitingApproval = permits.filter(
    (permit) => permit.status === "pending_approval",
  ).length;
  const permitDataAvailable = loaded && !failed.includes("permits");
  const queueDataAvailable = loaded && failed.length === 0;

  return (
    <main className="page-in mx-auto flex w-full max-w-370 flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-8 sm:pt-8">
      <section className="relative isolate overflow-hidden rounded-2xl bg-sidebar px-5 py-6 text-sidebar-foreground sm:px-8 sm:py-8 xl:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-28 size-96 rounded-full border border-sidebar-foreground/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-2 -top-14 size-64 rounded-full border border-sidebar-foreground/10"
        />
        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(25rem,0.8fr)] xl:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-primary">
              <Activity className="size-4" aria-hidden />
              Operations control desk
            </p>
            <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-sidebar-foreground/70">
              Your work, approvals, and site activity in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {canCreate ? (
                <Link
                  href="/permits/new"
                  className={buttonVariants({
                    size: "lg",
                    className:
                      "h-10 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
                  })}
                >
                  <FilePlus2 aria-hidden />
                  Create permit
                </Link>
              ) : null}
              {canReport ? (
                <Link
                  href="/incidents?new=1"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className:
                      "h-10 border-sidebar-foreground/25 bg-transparent text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
                  })}
                >
                  <Siren aria-hidden />
                  Report incident
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-sidebar-foreground/15 border-t border-sidebar-foreground/15 pt-5 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
            <Link
              href="/permits?view=needs-me"
              className="group px-3 first:pl-0 xl:px-5"
            >
              <span className="block font-heading text-3xl font-semibold tabular-nums text-sidebar-primary transition-transform group-hover:-translate-y-0.5 sm:text-4xl">
                {queueDataAvailable ? items.length : "—"}
              </span>
              <span className="mt-1 block text-xs leading-5 text-sidebar-foreground/70">
                Needs my action
              </span>
            </Link>
            <Link
              href="/permits?view=all&status=active"
              className="group px-3 xl:px-5"
            >
              <span className="block font-heading text-3xl font-semibold tabular-nums transition-transform group-hover:-translate-y-0.5 sm:text-4xl">
                {permitDataAvailable ? activePermits : "—"}
              </span>
              <span className="mt-1 block text-xs leading-5 text-sidebar-foreground/70">
                Active permits
              </span>
            </Link>
            <Link
              href="/permits?view=all&status=pending_approval"
              className="group px-3 pr-0 xl:px-5"
            >
              <span className="block font-heading text-3xl font-semibold tabular-nums transition-transform group-hover:-translate-y-0.5 sm:text-4xl">
                {permitDataAvailable ? awaitingApproval : "—"}
              </span>
              <span className="mt-1 block text-xs leading-5 text-sidebar-foreground/70">
                Awaiting approval
              </span>
            </Link>
          </div>
        </div>
      </section>

      {failed.length ? (
        <p className="text-sm text-destructive" role="status">
          Could not load {failed.join(", ")}. Affected dashboard counts are
          hidden until the data is available.
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.9fr)]">
        <section aria-labelledby="needs-you" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Personal worklist
              </p>
              <h2
                id="needs-you"
                className="mt-1 font-heading text-xl font-semibold tracking-tight"
              >
                My action queue
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {!loaded
                ? "Checking…"
                : queueDataAvailable
                  ? `${items.length} open`
                  : "Count unavailable"}
            </span>
          </div>
          <WorkQueuePanel
            emptyAction={
              canCreate ? (
                <Link
                  href="/permits/new"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Create permit
                </Link>
              ) : null
            }
          />
        </section>

        <aside className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Site intelligence
              </p>
              <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">
                Operational picture
              </h2>
            </div>
            {canViewAnalytics ? (
              <Link
                href="/analytics"
                aria-label="Open analytics"
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              >
                <ArrowUpRight aria-hidden />
              </Link>
            ) : null}
          </div>
          <HomeInsights />
        </aside>
      </div>
    </main>
  );
}
