"use client";

import { BackLink } from "@/components/layout/page-header";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Bug, CheckCircle2, Clock, Copy, UserRound } from "lucide-react";
import { ApiError } from "@/lib/api";
import { getPermit } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";
import { getApprovalReview } from "@/lib/approval/api";
import type { ApprovalReview } from "@/lib/approval/types";
import { formatApproverRoleLabel } from "@/lib/approval/labels";
import { getPermitAudit, getPermitHistory } from "@/lib/closure/api";
import type { AuditLogEntry, PermitHistoryEntry } from "@/lib/closure/types";
import { permitTemplatesApi, type PermitTemplate } from "@/lib/organisation/templates";
import { applicableTemplates, getWizardStepOwner, PERMIT_WIZARD_STEPS, permitDetailToForm, validateStep } from "@/lib/permit/form";
import { buildJourney, EDGES, formatDuration, NODE_BY_ID, stageTitle, type Journey } from "@/lib/permit/process";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import { formatDateTime, formatRelative, formatWindow } from "@/lib/format";
import { useWorkQueue } from "@/lib/work-queue-context";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { ProcessDetails, ProcessMap, ProcessMapLegend, StageChip, type MapSelection } from "@/components/permit/process-map";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, copyText } from "@/lib/utils";

type Check = { ok: boolean; label: string; who?: string };
type Waiting = { who: string; people: string[]; action: string; note?: string; due?: { at: string; overdue: boolean } };

const ACTION_LABEL: Record<string, string> = {
  created: "Created",
  submitted: "Submitted for approval",
  resubmitted: "Resubmitted",
  stage_advanced: "Approved a stage",
  approved: "Final approval",
  deferred: "Deferred",
  rejected: "Rejected",
  safety_veto: "Safety veto",
  sla_escalated: "Approval deadline passed, escalated",
  workflow_blocked: "Approval workflow blocked",
  activated: "Work started",
  suspended: "Suspended",
  resumed: "Resumed",
  revalidated: "Revalidated, back to approval",
  execution_completed: "Work declared complete",
  sent_back: "Sent back",
  verified: "Completion verified",
  closed: "Closed",
  cancelled: "Cancelled",
  expired: "Expired",
  unlogged: "Status changed (not logged)",
};

const END_STATES = new Set(["closed", "expired", "cancelled"]);

/** Who the permit is waiting on now, and for what. */
function waitingOn(detail: PermitDetail, review: ApprovalReview | null, journey: Journey, people: (id?: string | null) => string | null): Waiting | null {
  const { permit } = detail;
  const issuer = people(permit.submittedBy ?? permit.createdBy);
  const executors = detail.executors
    .slice()
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((e) => (e.isPrimary ? `${people(e.workforceUserId) ?? "Unknown"} (primary)` : people(e.workforceUserId) ?? "Unknown"));
  const lastComment = [...journey.events].reverse().find((e) => e.to === permit.status && e.comment)?.comment ?? undefined;

  switch (permit.status) {
    case "draft":
      return { who: "Job issuer and executor", people: [issuer, ...executors].filter(Boolean) as string[], action: "Finish the permit and submit it for approval" };
    case "deferred":
    case "rejected":
      return { who: "Job issuer", people: issuer ? [issuer] : [], action: "Revise the permit and resubmit it", note: lastComment };
    case "pending_approval": {
      const active = (review?.workflow ?? []).filter((row) => row.assignment.status === "active");
      const stages = new Set((review?.workflow ?? []).map((row) => row.step.stepSequence)).size;
      const step = active[0]?.step;
      const due = active.map((row) => row.assignment.slaDeadlineAt).filter(Boolean).sort()[0];
      return {
        who: step ? `${formatApproverRoleLabel(step.approverRole)}, stage ${step.stepSequence} of ${stages}: ${step.name}` : "Approvers",
        people: active.map((row) => people(row.assignment.assigneeId)).filter(Boolean) as string[],
        action: active.length > 1 ? `Decide on the permit (${active.length} approvers in parallel, ${step?.quorumMode === "first" ? "first to decide wins" : "all must decide"})` : "Approve, defer or reject the permit",
        due: due ? { at: due, overdue: new Date(due).getTime() < Date.now() } : undefined,
      };
    }
    case "approved":
      return {
        who: "Job executor",
        people: executors,
        action: "Check isolations and gas tests, then start work",
        due: permit.plannedStartAt ? { at: permit.plannedStartAt, overdue: new Date(permit.plannedStartAt).getTime() < Date.now() } : undefined,
      };
    case "active":
      return {
        who: "Primary executor",
        people: executors.filter((e) => e.endsWith("(primary)")),
        action: "Carry out the work, then declare it complete",
        due: permit.plannedEndAt ? { at: permit.plannedEndAt, overdue: new Date(permit.plannedEndAt).getTime() < Date.now() } : undefined,
      };
    case "suspended":
      return { who: "HOD or job issuer", people: issuer ? [issuer] : [], action: "Resolve the cause, then revalidate or resume", note: lastComment };
    case "execution_completed":
      return { who: "Job issuer", people: issuer ? [issuer] : [], action: "Check the finished work and verify it", note: lastComment };
    case "pending_closure":
      return { who: "HOD", people: [], action: "Give final sign-off and close the permit" };
    default:
      return null;
  }
}

const check = (ok: boolean, done: string, todo: string): Check => ({ ok, label: ok ? done : todo });

/** What stops the permit moving on right now. */
function checksFor(detail: PermitDetail, templates: PermitTemplate[]): Check[] {
  const { permit } = detail;
  const form = permitDetailToForm(detail);
  if (["draft", "deferred", "rejected"].includes(permit.status)) {
    const applicable = applicableTemplates(templates, permit.permitTypeId);
    return PERMIT_WIZARD_STEPS.slice(0, 5).flatMap((step, index): Check[] => {
      const errors = validateStep(form, index, applicable);
      const who = getWizardStepOwner(index) === "operator" ? "Executor" : getWizardStepOwner(index) === "shared" ? "Issuer or executor" : "Issuer";
      return errors.length ? errors.map((label) => ({ ok: false, label, who })) : [{ ok: true, label: step.label, who }];
    });
  }
  const checks: Check[] = [];
  if (["pending_approval", "approved", "active", "suspended"].includes(permit.status)) {
    checks.push(check(detail.executors.length > 0, "Executor assigned", "No executor assigned"));
    checks.push(check(detail.executors.some((e) => e.isPrimary), "Primary executor set", "No primary executor set"));
    if (permit.lototoRequired) checks.push(check(detail.lototo.length > 0, "LOTOTO procedure linked", "LOTOTO required but no procedure linked"));
    if (permit.gasTestingRequired) checks.push(check(detail.gasTesting.length > 0, "Gas tests chosen", "Gas testing required but no tests chosen"));
    const noAnswers = (permit.formResponses ?? []).reduce(
      (n, r) => n + r.config.sections.flatMap((s) => s.fields).filter((f) => f.type === "check" && r.answers[f.id] === "no").length,
      0,
    );
    checks.push({ ok: noAnswers === 0, label: noAnswers ? `${noAnswers} check sheet answer${noAnswers === 1 ? "" : "s"} marked No` : "No check sheet answers marked No" });
  }
  if (permit.plannedEndAt && ["approved", "active", "suspended"].includes(permit.status)) {
    const late = new Date(permit.plannedEndAt).getTime() < Date.now();
    checks.push({ ok: !late, label: late ? "Past the planned end. Request an extension or it will expire" : `Within the planned window (ends ${formatRelative(permit.plannedEndAt)})` });
  }
  return checks;
}

export default function PermitJourneyPage() {
  const { id } = useParams<{ id: string }>();
  const { items } = useWorkQueue();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [review, setReview] = useState<ApprovalReview | null>(null);
  const [history, setHistory] = useState<PermitHistoryEntry[] | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[] | null>(null);
  const [templates, setTemplates] = useState<PermitTemplate[]>([]);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapSelection>(null);
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    getPermit(id)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the permit"));
    getPermitHistory(id)
      .then(setHistory)
      .catch((err) => {
        setHistory([]);
        setHistoryError(err instanceof ApiError ? err.message : "Could not load the history");
      });
    getApprovalReview(id).then(setReview, () => setReview(null));
    getPermitAudit(id).then(setAudit, () => setAudit(null));
    permitTemplatesApi.list().then(setTemplates, () => setTemplates([]));
    loadLookups().then(setLookups, () => undefined);
  }, [id]);

  const journey = useMemo(() => (detail && history ? buildJourney(detail.permit, history) : null), [detail, history]);

  if (error) {
    return (
      <p role="alert" className="p-8 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!detail || !journey) return <p className="p-8 text-sm text-muted-foreground">Loading the permit journey…</p>;

  const { permit } = detail;
  const person = (pid?: string | null) => nameOf(lookups?.people, pid);
  const waiting = waitingOn(detail, review, journey, person);
  const checks = checksFor(detail, templates);
  const open = checks.filter((c) => !c.ok);
  const node = NODE_BY_ID.get(permit.status);
  const nextAction = items.find((item) => item.permit?.id === permit.id);
  const inStage = now - new Date(journey.enteredCurrentAt).getTime();
  const loops = [...journey.edges.entries()].filter(([edgeId, n]) => EDGES.find((e) => e.id === edgeId)?.tone === "back" && n > 0);

  const moveCount = journey.events.filter((e) => e.edgeId).length;
  const workflowRows = (review?.workflow ?? []).slice().sort((a, b) => a.step.stepSequence - b.step.stepSequence);
  const anomalies = [...journey.anomalies];
  if (permit.status === "pending_approval" && review && !workflowRows.some((r) => r.assignment.status === "active")) {
    anomalies.push("Pending approval but no approval stage is active. Nobody can act on it.");
  }
  if (["approved", "active"].includes(permit.status) && detail.executors.length === 0) {
    anomalies.push("Approved or active with no executor assigned. Nobody can start or complete the work.");
  }

  const debug = { permit, workflow: workflowRows, history, audit, anomalies };

  const facts: [string, React.ReactNode][] = [
    ["Permit type", nameOf(lookups?.permitTypes, permit.permitTypeId) ?? "—"],
    ["Location", [nameOf(lookups?.plants, permit.plantId), nameOf(lookups?.locations, permit.locationId), nameOf(lookups?.workstations, permit.workstationId)].filter(Boolean).join(" · ") || "—"],
    ["Equipment", nameOf(lookups?.machinery, permit.machineryId) ?? "—"],
    ["Planned window", formatWindow(permit.plannedStartAt, permit.plannedEndAt) || "Not set"],
    ["Issuer", person(permit.submittedBy ?? permit.createdBy) ?? "—"],
    ["Executors", detail.executors.map((e) => `${person(e.workforceUserId) ?? "Unknown"}${e.isPrimary ? " (primary)" : ""}`).join(", ") || "None assigned"],
    ["Safety officers", detail.safetyOfficers.map((s) => person(s.workforceUserId) ?? "Unknown").join(", ") || "None"],
    ["Hazards and PPE", `${detail.hazards.length} hazard${detail.hazards.length === 1 ? "" : "s"}, ${detail.ppe.length} PPE item${detail.ppe.length === 1 ? "" : "s"}`],
    ["Isolation (LOTOTO)", permit.lototoRequired ? `Required, ${detail.lototo.length} procedure${detail.lototo.length === 1 ? "" : "s"} linked` : "Not required"],
    ["Gas testing", permit.gasTestingRequired ? `Required, ${detail.gasTesting.length} test${detail.gasTesting.length === 1 ? "" : "s"}` : "Not required"],
    ["Forms and check sheets", (permit.formResponses ?? []).map((r) => r.name).join(", ") || "None filled in"],
    ["Attachments", String(detail.attachments.length)],
  ];

  return (
    <main className="flex flex-1 flex-col gap-5 p-4 sm:p-8">
      <div>
        <BackLink href={`/permits/${permit.id}`} label="Permit details" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{permit.title}</h1>
          <PermitStatusBadge status={permit.status} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          <span className="font-mono">{permit.reference ?? "No reference until submitted"}</span>
          <span>Journey and current state</span>
        </p>
      </div>

      {/* Now: the one thing everyone on the permit needs to know */}
      <section aria-labelledby="now-heading" className="grid gap-4 rounded-xl border border-border bg-card p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid content-start gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Now at</p>
            <h2 id="now-heading" className="text-xl font-semibold">
              {stageTitle(permit.status)}
              <span className="ml-2 inline-flex items-center gap-1 align-middle text-sm font-normal text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                {formatDuration(inStage)} here
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">{node?.meaning}</p>
          </div>

          {waiting ? (
            <div className="grid gap-1 rounded-lg border-l-4 border-(--status-warning) bg-(--status-warning-bg)/40 py-2 pl-4 pr-3">
              <p className="text-sm font-semibold">
                Waiting on {waiting.who}
                {waiting.people.length ? <span className="font-normal">: {waiting.people.join(", ")}</span> : null}
              </p>
              <p className="text-sm">{waiting.action}</p>
              {waiting.note ? <p className="text-sm text-muted-foreground">Last comment: &ldquo;{waiting.note}&rdquo;</p> : null}
              {waiting.due ? (
                <p className={cn("text-sm", waiting.due.overdue ? "font-medium text-(--status-danger)" : "text-muted-foreground")}>
                  {waiting.due.overdue ? "Overdue: " : "Due: "}
                  {formatDateTime(waiting.due.at)} ({formatRelative(waiting.due.at)})
                </p>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-(--status-success)" aria-hidden />
              Nothing is pending. This permit has reached an end state.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {nextAction ? (
              <Link href={nextAction.href} className={buttonVariants({ size: "lg" })}>
                Your next step: {nextAction.label}
                <ArrowRight aria-hidden />
              </Link>
            ) : node?.screen && !END_STATES.has(permit.status) ? (
              <Link href={node.screen(permit.id)} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Open the {stageTitle(permit.status).toLowerCase()} screen
              </Link>
            ) : null}
          </div>
        </div>

        {checks.length ? (
          <div className="grid content-start gap-2">
            <h3 className="text-sm font-semibold">
              {open.length ? `${open.length} thing${open.length === 1 ? "" : "s"} to sort out` : "Ready to move on"}
            </h3>
            <ul className="grid gap-1.5 text-sm">
              {[...open, ...checks.filter((c) => c.ok)].map((check, i) => (
                <li key={i} className="flex gap-2">
                  {check.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-(--status-success)" aria-label="Done" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-(--status-warning)" aria-label="To do" />
                  )}
                  <span className={check.ok ? "text-muted-foreground" : undefined}>
                    {check.label}
                    {check.who && !check.ok ? <span className="text-muted-foreground"> · {check.who}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Map with this permit's path lit */}
      <section aria-labelledby="map-heading" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="map-heading" className="text-lg font-semibold">
            Where it has been
          </h2>
          <p className="text-sm text-muted-foreground">
            {moveCount} move{moveCount === 1 ? "" : "s"}
            {loops.length ? `, sent back ${loops.reduce((n, [, c]) => n + c, 0)} time${loops.reduce((n, [, c]) => n + c, 0) === 1 ? "" : "s"}` : ""}
            {" · "}
            <Link href="/permits/process" className="text-primary hover:underline">
              Full process
            </Link>
          </p>
        </div>
        <ProcessMap run={{ current: permit.status, visited: journey.visited, edges: journey.edges, currentNote: `Now · ${formatDuration(inStage)}` }} selected={selected} onSelect={setSelected} />
        <ProcessMapLegend run />
        <p className="text-xs text-muted-foreground md:hidden">Scroll the map sideways to see every stage.</p>
        {selected ? (
          <ProcessDetails selection={selected} onSelect={setSelected}>
            <StepVisits journey={journey} selection={selected} person={person} />
          </ProcessDetails>
        ) : null}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* Timeline */}
        <section aria-labelledby="timeline-heading" className="rounded-xl border border-border bg-card">
          <h2 id="timeline-heading" className="border-b border-border px-5 py-3 text-sm font-semibold">
            Decisions and actions, oldest first
          </h2>
          {historyError ? <p className="px-5 py-3 text-sm text-muted-foreground">{historyError}</p> : null}
          <ol className="relative grid gap-0 px-5 py-3">
            {journey.events.map((event, i) => {
              const edge = EDGES.find((e) => e.id === event.edgeId);
              return (
                <li key={event.id + i} className="relative grid grid-cols-[1rem_1fr] gap-x-3 pb-4 last:pb-0">
                  <span
                    className={cn(
                      "mt-1.5 size-2.5 rounded-full ring-4 ring-card",
                      edge?.tone === "stop" ? "bg-(--status-danger)" : edge?.tone === "back" ? "bg-(--status-warning)" : event.edgeId ? "bg-primary" : "bg-muted-foreground/60",
                    )}
                    aria-hidden
                  />
                  {i < journey.events.length - 1 ? <span className="absolute left-[0.28rem] top-4 bottom-0 w-px bg-border" aria-hidden /> : null}
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium">{ACTION_LABEL[event.action] ?? event.action.replace(/_/g, " ")}</span>
                      {event.to && event.from && event.from !== event.to ? (
                        <span className="inline-flex items-center gap-1">
                          <StageChip id={event.from} onSelect={setSelected} />
                          <ArrowRight className="size-3 text-muted-foreground" aria-label="to" />
                          <StageChip id={event.to} onSelect={setSelected} />
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="size-3" aria-hidden />
                        {event.actorId ? person(event.actorId) ?? "Someone outside your view" : "System"}
                      </span>
                      <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                      {event.stayMs && event.stayMs > 0 && event.from ? <span>after {formatDuration(event.stayMs)} at {stageTitle(event.from)}</span> : null}
                      {event.inferred ? <span className="text-(--status-warning)">Worked out from the permit record</span> : null}
                    </p>
                    {event.comment ? <p className="mt-1 rounded-md bg-muted/60 px-2.5 py-1.5 text-sm">&ldquo;{event.comment}&rdquo;</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="grid gap-5">
          {/* Run-time data */}
          <section aria-labelledby="facts-heading" className="rounded-xl border border-border bg-card">
            <h2 id="facts-heading" className="border-b border-border px-5 py-3 text-sm font-semibold">
              What the decision rests on
            </h2>
            <dl className="grid gap-x-4 gap-y-2 px-5 py-3 text-sm sm:grid-cols-[9rem_1fr]">
              {facts.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-border px-5 py-2.5 text-sm">
              <Link href={`/permits/${permit.id}`} className="text-primary hover:underline">
                Full permit, forms and answers
              </Link>
            </p>
          </section>

          {workflowRows.length ? (
            <section aria-labelledby="stages-heading" className="rounded-xl border border-border bg-card">
              <h2 id="stages-heading" className="border-b border-border px-5 py-3 text-sm font-semibold">
                Approval stages
              </h2>
              <ol className="grid gap-2 px-5 py-3 text-sm">
                {workflowRows.map((row) => {
                  const decision = review?.decisions.find((d) => d.workflowAssignmentId === row.assignment.id);
                  return (
                    <li key={row.assignment.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span>
                        <span className="tabular-nums text-muted-foreground">{row.step.stepSequence}.</span> {row.step.name}
                        <span className="text-muted-foreground"> · {person(row.assignment.assigneeId) ?? formatApproverRoleLabel(row.step.approverRole)}</span>
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium capitalize",
                          row.assignment.status === "active" ? "text-(--status-warning)" : row.assignment.status === "completed" ? "text-(--status-success)" : "text-muted-foreground",
                        )}
                      >
                        {row.assignment.status === "active" ? "Waiting" : decision ? decision.decision : row.assignment.status}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </div>
      </div>

      {/* Debugging */}
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-5 py-3 text-sm font-semibold">
          <Bug className="size-4 text-muted-foreground" aria-hidden />
          Debugging information
          {anomalies.length ? (
            <span className="rounded-full bg-(--status-danger-bg) px-2 py-0.5 text-xs font-medium text-(--status-danger)">
              {anomalies.length} issue{anomalies.length === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">Record is consistent</span>
          )}
        </summary>
        <div className="grid gap-4 border-t border-border px-5 py-4 text-sm">
          {anomalies.length ? (
            <ul className="grid gap-1">
              {anomalies.map((a) => (
                <li key={a} className="flex gap-2 text-(--status-danger)">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          ) : null}
          <dl className="grid gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-[11rem_1fr]">
            {[
              ["permit.id", permit.id],
              ["status", permit.status],
              ["draft step", String(detail.draft?.currentStep ?? "—")],
              ["entered stage", journey.enteredCurrentAt],
              ["created", permit.createdAt],
              ["submitted", permit.submittedAt ?? "—"],
              ["updated", permit.updatedAt],
              ["history entries", String(history?.length ?? 0)],
              ["audit entries", audit ? String(audit.length) : "Not visible to your role"],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-all">{v}</dd>
              </div>
            ))}
          </dl>
          {workflowRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    {["Stage", "Role / slot", "Mode", "Status", "Assigned", "Completed", "Deadline"].map((h) => (
                      <th key={h} className="py-1 pr-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {workflowRows.map((row) => (
                    <tr key={row.assignment.id} className="border-t border-border">
                      <td className="py-1 pr-3">{row.step.stepSequence}. {row.step.name}</td>
                      <td className="py-1 pr-3">{row.assignment.assignmentSlot ?? row.step.approverRole}</td>
                      <td className="py-1 pr-3">{row.step.stageMode ?? "sequential"}/{row.step.quorumMode ?? "all"}</td>
                      <td className="py-1 pr-3">{row.assignment.status}</td>
                      <td className="py-1 pr-3">{formatDateTime(row.assignment.assignedAt)}</td>
                      <td className="py-1 pr-3">{row.assignment.completedAt ? formatDateTime(row.assignment.completedAt) : "—"}</td>
                      <td className="py-1 pr-3">{row.assignment.slaDeadlineAt ? formatDateTime(row.assignment.slaDeadlineAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {audit?.length ? (
            <div>
              <h3 className="mb-1 text-xs font-semibold">Audit log</h3>
              <ol className="grid gap-0.5 font-mono text-xs">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap gap-x-3">
                    <span className="text-muted-foreground">{entry.createdAt}</span>
                    <span>{entry.action}</span>
                    <span className="text-muted-foreground">{person(entry.userId) ?? entry.userId}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void copyText(JSON.stringify(debug, null, 2)).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              <Copy aria-hidden />
              {copied ? "Copied" : "Copy debug data for support"}
            </Button>
          </div>
        </div>
      </details>
    </main>
  );
}

/** For a selected stage or move: when this permit was there, who acted, and what they said. */
function StepVisits({ journey, selection, person }: { journey: Journey; selection: NonNullable<MapSelection>; person: (id?: string | null) => string | null }) {
  const events =
    selection.kind === "edge"
      ? journey.events.filter((e) => e.edgeId === selection.id)
      : journey.events.filter((e) => e.to === selection.id || (e.from === selection.id && e.edgeId));
  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-sm font-semibold">This permit</h3>
      {events.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{selection.kind === "edge" ? "Never taken on this permit." : "Never reached on this permit."}</p>
      ) : (
        <ul className="mt-1 grid gap-1 text-sm">
          {events.map((e, i) => (
            <li key={e.id + i}>
              <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
              <span className="text-muted-foreground">
                {" "}
                by {e.actorId ? person(e.actorId) ?? "someone outside your view" : "the system"}, {formatDateTime(e.at)}
              </span>
              {e.comment ? <span> &ldquo;{e.comment}&rdquo;</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
