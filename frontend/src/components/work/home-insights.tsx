"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { AnimatedNumber } from "@/components/analytics/animated-number";
import { SegmentedBar, StatTile } from "@/components/analytics/charts";
import { buttonVariants } from "@/components/ui/button";
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

  useEffect(() => {
    getInsights(30).then(setData, () => undefined);
  }, []);

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
  const live = permits.filter((p) => ["approved", "active", "suspended"].includes(p.status)).length;

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid gap-4 lg:grid-cols-[14rem_1fr_1fr]">
      <motion.div variants={staggerItem} className="grid gap-3">
        <StatTile label="Permits you can see" value={<AnimatedNumber value={permits.length} />} href="/permits" />
        <StatTile label="Approved or in progress" value={<AnimatedNumber value={live} />} href="/permits?stage=live" />
      </motion.div>
      <motion.section variants={staggerItem} className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold">Where your permits stand</h3>
        <p className="mb-4 text-sm text-muted-foreground">By lifecycle stage.</p>
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
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="home-insights" className="text-lg font-semibold">
            {managesSite ? "Site at a glance" : "Your permits"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {managesSite ? "Last 30 days. Anything above zero needs someone's attention." : "What you are working on and what is coming up."}
          </p>
        </div>
        {managesSite ? (
          <Link href="/analytics" className={buttonVariants({ variant: "outline" })}>
            Open analytics
            <ArrowRight aria-hidden />
          </Link>
        ) : null}
      </div>
      {managesSite ? <SiteAttention /> : <MyPermits />}
    </section>
  );
}
