"use client";

import Link from "next/link";
import { FilePlus2, Siren } from "lucide-react";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { DASHBOARD_ANALYTICS_ROLES, INCIDENT_REPORT_ROLES, PERMIT_CREATE_ROLES } from "@/lib/auth/roles";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
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
  const { items, loaded } = useWorkQueue();
  const canCreate = hasAnyRole(roles, PERMIT_CREATE_ROLES);
  const canReport = hasAnyRole(roles, INCIDENT_REPORT_ROLES);
  const managesSite = hasAnyRole(roles, DASHBOARD_ANALYTICS_ROLES);
  const firstName = profile?.firstName || profile?.displayName?.split(" ")[0] || "";

  return (
    <main className="flex flex-1 flex-col gap-8 px-4 pb-8 sm:px-8">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description={
          !loaded ? (
            "Checking your work…"
          ) : items.length === 0 ? (
            "You are all caught up."
          ) : (
            <>
              <strong className="font-heading text-lg font-extrabold text-(--accent-primary) tabular-nums">{items.length}</strong>{" "}
              {items.length === 1 ? "item needs" : "items need"} your action.
            </>
          )
        }
        actions={
          <>
            {canReport ? (
              <Link href="/incidents?new=1" className={buttonVariants({ variant: "outline", size: "lg" })}>
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
          </>
        }
      />

      {/* Site figures are a few tiles: managers see them first. Everyone else's own-permit
          summary is taller, so their queue leads. Messages live under the header bell. */}
      {managesSite ? <HomeInsights /> : null}

      <section aria-labelledby="needs-you">
        <SectionTitle id="needs-you" title="Needs you" description="Grouped by what you have to do. Urgent jobs glow." />
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

      {managesSite ? null : <HomeInsights />}
    </main>
  );
}
