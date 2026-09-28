"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { AnimatedNumber } from "@/components/analytics/animated-number";
import { StatTile } from "@/components/analytics/charts";
import { ExecutionStatusBadge } from "@/components/isolation-execution/execution-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { PlanStatusBadge } from "@/components/lototo/plan-status-badge";
import { LototoPlanCreatePanel } from "@/components/safety/create-panels";
import { EmptyState, ErrorNote, RecordList, RecordRow } from "@/components/safety/record-list";
import { Button } from "@/components/ui/button";
import { MultiToggle, SegmentedToggle } from "@/components/ui/toggle-group";
import { ActionButtonLink } from "@/components/work/action-link";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { LOTOTO_WRITE_ROLES } from "@/lib/auth/roles";
import { formatRelative } from "@/lib/format";
import { getIsolationExecutionForPlan } from "@/lib/isolation-execution/api";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { LOTOTO_PLAN_STATUS } from "@/lib/safety/status";

type View = "plans" | "active" | "restoration";
type Execution = { planId: string; executionId: string; status: string };

function LototoBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { roles } = useAuthProfile();
  const canCreate = hasAnyRole(roles, LOTOTO_WRITE_ROLES);
  const view = (["plans", "active", "restoration"].includes(params.get("view") ?? "") ? params.get("view") : "plans") as View;
  const statuses = (params.get("status") ?? "").split(",").filter(Boolean);
  const creating = params.get("new") === "1" && canCreate;

  const [plans, setPlans] = useState<LototoPlan[] | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setParams(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
    listLototoPlans()
      .then(async (rows) => {
        setPlans(rows);
        // Isolation state lives on the execution; only plans in execution have one.
        const found = await Promise.all(
          rows
            .filter((plan) => plan.status === "in_execution")
            .map((plan) =>
              getIsolationExecutionForPlan(plan.id).then(
                (d): Execution => ({ planId: plan.id, executionId: d.execution.id, status: d.execution.status }),
                () => null,
              ),
            ),
        );
        setExecutions(found.filter((e): e is Execution => e !== null));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "LOTOTO plans could not be loaded. Try again."));
  }, []);

  const executionByPlan = useMemo(() => new Map(executions.map((e) => [e.planId, e])), [executions]);
  const all = plans ?? [];
  const active = all.filter((p) => p.status === "ready" || p.status === "in_execution");
  const restoration = all.filter((p) => ["verified", "restored"].includes(executionByPlan.get(p.id)?.status ?? ""));
  const byView = { plans: all.filter((p) => statuses.length === 0 || statuses.includes(p.status)), active, restoration }[view];
  const rows = [...byView].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const machineryOf = (plan: LototoPlan) => nameOf(lookups?.machinery, plan.machineryId) ?? nameOf(lookups?.workstations, plan.workstationId) ?? "Machinery not set";

  function nextStep(plan: LototoPlan) {
    const execution = executionByPlan.get(plan.id);
    if (execution?.status === "verified") return <ActionButtonLink href={`/lototo/restoration/${execution.executionId}`} kind="do" urgent>Restore</ActionButtonLink>;
    if (execution?.status === "restored") return <ActionButtonLink href={`/lototo/restoration/${execution.executionId}`} kind="admin">Summary</ActionButtonLink>;
    if (plan.status === "ready") return <ActionButtonLink href={`/lototo/execute/${plan.id}`} kind="do">Start isolation</ActionButtonLink>;
    if (plan.status === "in_execution") return <ActionButtonLink href={`/lototo/execute/${plan.id}`} kind="do">Continue</ActionButtonLink>;
    if (plan.status === "draft" && canCreate) return <ActionButtonLink href={`/lototo/plans/${plan.id}`} kind="fix">Finish plan</ActionButtonLink>;
    return null;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        title="LOTOTO"
        description="Lock-out, tag-out, try-out: plan the isolation of hazardous energy, apply it before work, and restore after."
        actions={
          canCreate && !creating ? (
            <Button type="button" size="lg" onClick={() => setParams({ new: "1" })}>
              <Plus aria-hidden />
              New LOTOTO plan
            </Button>
          ) : null
        }
      >
        <SegmentedToggle
          label="View"
          value={view}
          onChange={(v) => setParams({ view: v === "plans" ? "" : v, status: "" })}
          options={[
            { value: "plans", label: "All plans", count: all.length },
            { value: "active", label: "Ready and in execution", count: active.length },
            { value: "restoration", label: "Restoration", count: restoration.length },
          ]}
          className="self-start"
        />
        {view === "plans" ? (
          <MultiToggle
            label="Status"
            selected={statuses}
            onChange={(next) => setParams({ status: next.join(",") })}
            options={Object.entries(LOTOTO_PLAN_STATUS).map(([key, tone]) => ({
              value: key,
              label: tone.label,
              color: tone.color,
              count: all.filter((p) => p.status === key).length,
            }))}
          />
        ) : null}

        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { label: "Plans", value: all.length, href: "/lototo" },
            { label: "Ready to isolate", value: all.filter((p) => p.status === "ready").length, href: "/lototo?view=active" },
            { label: "In execution", value: all.filter((p) => p.status === "in_execution").length, href: "/lototo?view=active", tone: "warning" as const },
            { label: "Awaiting restoration", value: restoration.filter((p) => executionByPlan.get(p.id)?.status === "verified").length, href: "/lototo?view=restoration", tone: "danger" as const },
          ].map((t) => (
            <motion.div key={t.label} variants={staggerItem}>
              <StatTile compact label={t.label} value={<AnimatedNumber value={t.value} />} href={t.href} tone={t.tone && t.value > 0 ? t.tone : "neutral"} />
            </motion.div>
          ))}
        </motion.div>
      </PageHeader>

      {creating ? <LototoPlanCreatePanel initialMachineryId={params.get("machineryId") ?? undefined} onClose={() => setParams({ new: "", machineryId: "" })} /> : null}

      <ErrorNote message={error} />

      {plans === null ? (
        <p className="text-sm text-muted-foreground">Loading LOTOTO plans…</p>
      ) : (
        <>

          {rows.length === 0 ? (
            <EmptyState
              title={view === "restoration" ? "No verified isolations waiting to be restored" : view === "active" ? "No plans are ready for isolation" : "No LOTOTO plans match"}
              hint={view === "plans" && all.length === 0 ? "Create a plan for a machine so permits can use it when isolation is required." : undefined}
            />
          ) : (
            <RecordList headers={["Plan", "Machinery", "Status", "Next step"]}>
              {rows.map((plan, i) => {
                const execution = executionByPlan.get(plan.id);
                return (
                  <RecordRow
                    key={plan.id}
                    index={i}
                    href={`/lototo/plans/${plan.id}`}
                    title={plan.title}
                    reference={plan.reference}
                    meta={<span>Updated {formatRelative(plan.updatedAt)}</span>}
                    context={machineryOf(plan)}
                    accent={LOTOTO_PLAN_STATUS[plan.status]?.color}
                    status={
                      <span className="flex flex-col items-start gap-1">
                        <PlanStatusBadge status={plan.status} />
                        {execution ? <ExecutionStatusBadge status={execution.status} /> : null}
                      </span>
                    }
                    action={nextStep(plan)}
                  />
                );
              })}
            </RecordList>
          )}
        </>
      )}
    </main>
  );
}

export default function LototoPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading LOTOTO…</main>}>
      <LototoBoard />
    </Suspense>
  );
}
