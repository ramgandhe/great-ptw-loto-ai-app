"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, SearchCheck, ShieldCheck, UserCheck } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  assignInvestigation,
  createCorrectiveAction,
  createPreventiveAction,
  recordRootCause,
  updateCorrectiveAction,
} from "@/lib/incidents/api";
import type { ActionStatus, InvestigationDetail } from "@/lib/incidents/types";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { INVESTIGATION_ASSIGN_ROLES, INVESTIGATION_WRITE_ROLES } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import { listTenantUserNames } from "@/lib/workforce/api";
import { fieldClassName } from "@/components/permit/form-field";
import { SelectField } from "@/components/lototo/select-field";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { toast } from "@/components/ui/toast";

const ACTION_TONE: Record<ActionStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "var(--st-pending_approval)" },
  in_progress: { label: "In progress", color: "var(--st-active)" },
  completed: { label: "Completed", color: "var(--st-closed)" },
  cancelled: { label: "Cancelled", color: "var(--st-cancelled)" },
};

type Props = { incidentId: string; detail: InvestigationDetail | null; onUpdated: () => void | Promise<void> };

function Step({ icon: Icon, title, count, children }: { icon: typeof SearchCheck; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
        <Icon className="size-4 text-(--act-do)" aria-hidden />
        {title}
        {count ? <span className="rounded-full bg-muted px-2 text-xs tabular-nums text-muted-foreground">{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/** Investigation of an incident: assign a lead, record root causes, then corrective and preventive actions. */
export function InvestigationWorkflow({ incidentId, detail, onUpdated }: Props) {
  const { roles } = useAuthProfile();
  const canAssign = hasAnyRole(roles, INVESTIGATION_ASSIGN_ROLES);
  const canWrite = hasAnyRole(roles, INVESTIGATION_WRITE_ROLES);
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [investigatorId, setInvestigatorId] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [corrective, setCorrective] = useState({ title: "", ownerId: "", dueDate: "" });
  const [preventive, setPreventive] = useState({ title: "", ownerId: "", dueDate: "" });

  useEffect(() => {
    // Sign-in accounts, so the investigator and action owners see the work in their queue.
    listTenantUserNames()
      .then((users) =>
        setPeople(
          users
            .map((u) => ({ value: u.id, label: u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.username }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ),
      )
      .catch(() => setPeople([]));
  }, []);

  const nameOf = useMemo(() => new Map(people.map((p) => [p.value, p.label])), [people]);
  const today = new Date().toISOString().slice(0, 10);

  async function run(action: () => Promise<unknown>, done: string, reset?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      reset?.();
      toast(done);
      await onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const errorNote = error ? (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  ) : null;

  if (!detail) {
    return (
      <Step icon={UserCheck} title="Investigation">
        {errorNote}
        {canAssign ? (
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => assignInvestigation(incidentId, { investigatorId }), "Investigator assigned", () => setInvestigatorId(""));
            }}
          >
            <SelectField
              id="incident-investigator"
              label="Lead investigator"
              hint="They see this incident in their queue and record the findings."
              value={investigatorId}
              options={people}
              placeholder={people.length ? "Choose a person" : "No people in this organisation yet"}
              required
              onChange={setInvestigatorId}
            />
            <Button type="submit" disabled={busy || !investigatorId}>
              Assign investigator
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for a safety officer to assign an investigator.</p>
        )}
      </Step>
    );
  }

  const { investigation, rootCauses, correctiveActions, preventiveActions } = detail;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Lead investigator <strong className="text-foreground">{nameOf.get(investigation.investigatorId) ?? "Assigned"}</strong>
        {investigation.dueDate ? ` · due ${formatDate(investigation.dueDate)}` : ""} · {investigation.status.replace(/_/g, " ")}
      </p>
      {errorNote}

      <Step icon={SearchCheck} title="Root causes" count={rootCauses.length}>
        {rootCauses.length ? (
          <ul className="grid gap-2 text-sm">
            {rootCauses.map((cause) => (
              <li key={cause.id} className="rounded-lg bg-muted/50 px-3 py-2">
                {cause.description}
                {cause.findings ? <span className="mt-1 block text-muted-foreground">{cause.findings}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {canWrite ? (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => recordRootCause(incidentId, { description: rootCause.trim() }), "Root cause recorded", () => setRootCause(""));
            }}
          >
            <label htmlFor="root-cause" className="text-sm font-medium">
              {rootCauses.length ? "Add another root cause" : "What caused it?"}
            </label>
            <textarea id="root-cause" required value={rootCause} onChange={(e) => setRootCause(e.target.value)} className={`${fieldClassName} min-h-20 py-2`} />
            <Button type="submit" variant="outline" disabled={busy || !rootCause.trim()} className="justify-self-start">
              Record root cause
            </Button>
          </form>
        ) : null}
      </Step>

      <Step icon={ClipboardCheck} title="Corrective actions" count={correctiveActions.length}>
        {correctiveActions.length ? (
          <ul className="grid gap-2 text-sm">
            {correctiveActions.map((action) => {
              const open = action.status === "open" || action.status === "in_progress";
              return (
                <li key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <span>
                    <span className="font-medium">{action.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {nameOf.get(action.ownerId) ?? "Owner"} · due {formatDate(action.dueDate)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusChip {...ACTION_TONE[action.status]} />
                    {canWrite && open ? (
                      <>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => updateCorrectiveAction(action.id, { status: "completed" }), "Corrective action completed")}>
                          Mark complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Cancel “${action.title}”? It stays in the record as cancelled.`)) {
                              void run(() => updateCorrectiveAction(action.id, { status: "cancelled" }), "Corrective action cancelled");
                            }
                          }}
                        >
                          Cancel action
                        </Button>
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {canWrite ? (
          <form
            className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () => createCorrectiveAction(incidentId, { title: corrective.title.trim(), ownerId: corrective.ownerId, dueDate: new Date(corrective.dueDate).toISOString() }),
                "Corrective action added",
                () => setCorrective({ title: "", ownerId: "", dueDate: "" }),
              );
            }}
          >
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Fix to make</span>
              <input required value={corrective.title} onChange={(e) => setCorrective({ ...corrective, title: e.target.value })} className={fieldClassName} />
            </label>
            <SelectField id="corrective-owner" label="Owner" required value={corrective.ownerId} options={people} placeholder="Choose" onChange={(ownerId) => setCorrective({ ...corrective, ownerId })} />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Due</span>
              <input type="date" required min={today} value={corrective.dueDate} onChange={(e) => setCorrective({ ...corrective, dueDate: e.target.value })} className={fieldClassName} />
            </label>
            <Button type="submit" variant="outline" disabled={busy}>
              Add
            </Button>
          </form>
        ) : null}
      </Step>

      <Step icon={ShieldCheck} title="Preventive actions" count={preventiveActions.length}>
        {preventiveActions.length ? (
          <ul className="grid gap-2 text-sm">
            {preventiveActions.map((action) => (
              <li key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                <span>
                  <span className="font-medium">{action.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {nameOf.get(action.ownerId) ?? "Owner"}
                    {action.dueDate ? ` · due ${formatDate(action.dueDate)}` : ""}
                  </span>
                </span>
                <StatusChip {...ACTION_TONE[action.status]} />
              </li>
            ))}
          </ul>
        ) : null}
        {canWrite ? (
          <form
            className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  createPreventiveAction(incidentId, {
                    title: preventive.title.trim(),
                    ownerId: preventive.ownerId,
                    ...(preventive.dueDate ? { dueDate: new Date(preventive.dueDate).toISOString() } : {}),
                  }),
                "Preventive action added",
                () => setPreventive({ title: "", ownerId: "", dueDate: "" }),
              );
            }}
          >
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Stop it happening again</span>
              <input required value={preventive.title} onChange={(e) => setPreventive({ ...preventive, title: e.target.value })} className={fieldClassName} />
            </label>
            <SelectField id="preventive-owner" label="Owner" required value={preventive.ownerId} options={people} placeholder="Choose" onChange={(ownerId) => setPreventive({ ...preventive, ownerId })} />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Due (optional)</span>
              <input type="date" min={today} value={preventive.dueDate} onChange={(e) => setPreventive({ ...preventive, dueDate: e.target.value })} className={fieldClassName} />
            </label>
            <Button type="submit" variant="outline" disabled={busy}>
              Add
            </Button>
          </form>
        ) : null}
      </Step>
    </div>
  );
}
