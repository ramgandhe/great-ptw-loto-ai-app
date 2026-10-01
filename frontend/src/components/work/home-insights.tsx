"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { AnimatedNumber } from "@/components/analytics/animated-number";
import { SegmentedBar, StatTile } from "@/components/analytics/charts";
import { SectionTitle } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { PERMIT_STAGES } from "@/lib/analytics/labels";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { DASHBOARD_ANALYTICS_ROLES } from "@/lib/auth/roles";
import { getInsights } from "@/lib/dashboards/api";
import type { InsightsPayload } from "@/lib/dashboards/types";
import { formatDateTime } from "@/lib/format";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useWorkQueue } from "@/lib/work-queue-context";

const WEEK_MS = 7 * 86_400_000;

/** Site-wide attention figures for people who manage the site. */
function SiteAttention() {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getInsights(30).then(
      (payload) => {
        setData(payload);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [attempt]);

  // A failed read must not look like "All clear" on every tile.
  if (failed && !data) {
    return (
      <p role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
        Site figures could not be loaded.
        <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
          Retry
        </Button>
      </p>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground">Loading site figures…</p>;
  const a = data.attention;
  const tiles = [
    { label: "Work past planned end", value: a.overdueActivePermits, href: "/execution", tone: "danger" as const },
    { label: "Approvals waiting over a day", value: a.approvalsWaitingOverDay, href: "/approvals", tone: "warning" as const },
    { label: "High-severity SIMOPS clashes", value: a.highSeverityConflicts, href: "/simops/conflicts", tone: "danger" as const },
    { label: "Serious incidents open", value: a.criticalIncidentsOpen, href: "/incidents", tone: "danger" as const },
  ];
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <motion.div key={t.label} variants={staggerItem}>
          <StatTile
            label={t.label}
            value={<AnimatedNumber value={t.value} />}
            href={t.href}
            tone={t.value > 0 ? t.tone : "neutral"}
            hint={t.value > 0 ? "Open to act" : "All clear"}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

/** The signed-in person's own permits: where they stand and what starts this week. */
function MyPermits() {
  const { permits, loaded } = useWorkQueue();
  // Captured once per mount; "this week" doesn't need to tick while the page is open.
  const [now] = useState(() => Date.now());
  if (!loaded) return <p className="text-sm text-muted-foreground">Loading your permits…</p>;

  const upcoming = permits
    .filter((p) => p.plannedStartAt && ["approved", "pending_approval"].includes(p.status))
    .filter((p) => {
      const start = new Date(p.plannedStartAt!).getTime();
      return start >= now - 86_400_000 && start <= now + WEEK_MS;
    })
    .sort((a, b) => a.plannedStartAt!.localeCompare(b.plannedStartAt!))
    .slice(0, 5);

  // Totals live on the permit list's views; here only the shape and what starts soon.
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-4 lg:grid-cols-2">
      <motion.section variants={staggerItem} className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold">Where your permits stand</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          By lifecycle stage.{" "}
          <Link href="/permits?view=all" className="text-primary hover:underline">
            All {permits.length} permits
          </Link>
        </p>
        <SegmentedBar
          emptyMessage="No permits yet."
          segments={PERMIT_STAGES.map((s) => ({ ...s, count: permits.filter((p) => p.status === s.key).length })).filter((s) => s.count > 0)}
        />
      </motion.section>
      <motion.section variants={staggerItem} className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold">Starting in the next 7 days</h3>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled to start this week.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {upcoming.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/permits/${p.id}`} className="min-w-0 truncate font-medium hover:underline">
                  {p.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(p.plannedStartAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </motion.div>
  );
}

export function HomeInsights() {
  const { roles } = useAuthProfile();
  const managesSite = hasAnyRole(roles, DASHBOARD_ANALYTICS_ROLES);
  return (
    <section aria-labelledby="home-insights">
      <SectionTitle
        id="home-insights"
        title={managesSite ? "Site at a glance" : "Your permits"}
        description={managesSite ? "Last 30 days. Anything above zero needs someone's attention." : "What you are working on and what is coming up."}
        action={
          managesSite ? (
            <Link href="/analytics" className={buttonVariants({ variant: "outline" })}>
              Open analytics
              <ArrowRight aria-hidden />
            </Link>
          ) : null
        }
      />
      {managesSite ? <SiteAttention /> : <MyPermits />}
    </section>
  );
}
