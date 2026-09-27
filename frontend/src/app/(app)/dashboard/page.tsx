"use client";

import Link from "next/link";
import { FilePlus2, Siren } from "lucide-react";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { INCIDENT_REPORT_ROLES, PERMIT_CREATE_ROLES } from "@/lib/auth/roles";
import { DashboardNotificationsPanel } from "@/components/dashboards/dashboard-notifications-panel";
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

/** Home: what needs you first, then the figures for your role, then messages. */
export default function DashboardPage() {
  const { roles, profile } = useAuthProfile();
  const { items, loaded } = useWorkQueue();
  const canCreate = hasAnyRole(roles, PERMIT_CREATE_ROLES);
  const canReport = hasAnyRole(roles, INCIDENT_REPORT_ROLES);
  const firstName = profile?.firstName || profile?.displayName?.split(" ")[0] || "";

  return (
    <main className="flex flex-1 flex-col gap-10 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {!loaded
              ? "Checking your work…"
              : items.length === 0
                ? "You are all caught up."
                : `${items.length} ${items.length === 1 ? "item needs" : "items need"} your action.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReport ? (
            <Link href="/incidents/new" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Siren aria-hidden />
              Report incident
            </Link>
          ) : null}
          {canCreate ? (
            <Link href="/permits/new" className={buttonVariants({ size: "lg" })}>
              <FilePlus2 aria-hidden />
              Create permit
            </Link>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="needs-you">
        <h2 id="needs-you" className="mb-3 text-lg font-semibold">
          Needs you
        </h2>
        <WorkQueuePanel
          emptyAction={
            canCreate ? (
              <Link href="/permits/new" className={buttonVariants({ variant: "outline" })}>
                Create permit
              </Link>
            ) : null
          }
        />
      </section>

      <HomeInsights />

      <DashboardNotificationsPanel />
    </main>
  );
}
