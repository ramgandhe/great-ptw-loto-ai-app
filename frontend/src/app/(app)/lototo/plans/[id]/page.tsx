"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { machineryApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import {
  addIsolationPoint,
  assignLototoPersonnel,
  configureIsolationSequence,
  getLototoPlan,
} from "@/lib/lototo/api";
import type {
  IsolationPoint,
  IsolationSequenceStep,
  LototoAssignment,
  LototoAssignmentRole,
  LototoPlan,
} from "@/lib/lototo/types";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { PlanStatusBadge } from "@/components/lototo/plan-status-badge";
import { Button } from "@/components/ui/button";

export default function LototoPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const planId = params.id;

  const [plan, setPlan] = useState<LototoPlan | null>(null);
  const [machinery, setMachinery] = useState<OrgRecord[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceRecord[]>([]);
  const [isolationPoints, setIsolationPoints] = useState<IsolationPoint[]>([]);
  const [assignments, setAssignments] = useState<LototoAssignment[]>([]);
  const [sequence, setSequence] = useState<IsolationSequenceStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isolationNumber, setIsolationNumber] = useState("");
  const [machineryId, setMachineryId] = useState("");
  const [isolationDescription, setIsolationDescription] = useState("");
  const [energySourceType, setEnergySourceType] = useState("electrical");
  const [workforceUserId, setWorkforceUserId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<LototoAssignmentRole>("isolation_officer");

  const loadDetail = useCallback(async () => {
    const detail = await getLototoPlan(planId);
    setPlan(detail.plan);
    setIsolationPoints(detail.isolationPoints);
    setAssignments(detail.assignments);
    setSequence(detail.sequence);
  }, [planId]);

  useEffect(() => {
    Promise.all([loadDetail(), machineryApi.list(), listWorkforceDirectory()])
      .then(([, mc, directory]) => {
        setMachinery(mc);
        setWorkforce(directory);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load plan");
      });
  }, [loadDetail]);

  async function handleAddIsolationPoint(event: React.FormEvent) {
    event.preventDefault();
    if (!isolationNumber.trim() || !machineryId) {
      setActionError("Isolation number and machinery are required.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setMessage(null);
    try {
      await addIsolationPoint(planId, {
        machineryId,
        isolationNumber: isolationNumber.trim(),
        description: isolationDescription.trim() || undefined,
        verificationRequired: true,
        energySource: {
          energySourceType,
        },
      });
      setIsolationNumber("");
      setIsolationDescription("");
      await loadDetail();
      setMessage("Isolation point added.");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to add isolation point");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignPersonnel(event: React.FormEvent) {
    event.preventDefault();
    if (!workforceUserId) {
      setActionError("Select a workforce member.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setMessage(null);
    try {
      await assignLototoPersonnel(planId, {
        workforceUserId,
        role: assignmentRole,
      });
      await loadDetail();
      setMessage("Personnel assigned.");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to assign personnel");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveSequence() {
    if (isolationPoints.length === 0) {
      setActionError("Add at least one isolation point before configuring sequence.");
      return;
    }

    const confirmed = window.confirm(
      "Save this isolation sequence? The plan will move to Ready and should be verified before field execution.",
    );
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setMessage(null);
    try {
      await configureIsolationSequence(planId, {
        steps: isolationPoints.map((point, index) => ({
          isolationPointId: point.id,
          sequenceOrder: index + 1,
          requiresVerification: point.verificationRequired,
        })),
      });
      await loadDetail();
      setMessage("Isolation sequence saved. Plan is ready for execution.");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save sequence");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="p-8 text-sm text-destructive" role="alert">
        {error}
      </div>
    );
  }

  if (!plan) {
    return <p className="p-8 text-sm text-muted-foreground">Loading plan…</p>;
  }

  const editable = plan.status === "draft" || plan.status === "ready";
  const orderedPoints =
    sequence.length > 0
      ? [...isolationPoints].sort((a, b) => {
          const aOrder = sequence.find((step) => step.isolationPointId === a.id)?.sequenceOrder ?? 999;
          const bOrder = sequence.find((step) => step.isolationPointId === b.id)?.sequenceOrder ?? 999;
          return aOrder - bOrder;
        })
      : isolationPoints;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/lototo" className="text-sm text-muted-foreground hover:text-foreground">
          ← LOTOTO plans
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{plan.title}</h1>
          <PlanStatusBadge status={plan.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan.description ?? "No description"} ·{" "}
          <Link href={`/permits/${plan.permitId}`} className="underline">
            View permit
          </Link>
        </p>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {actionError}
        </div>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {message}
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-medium">Isolation points</h2>
          <p className="mb-4 text-sm text-muted-foreground">Define energy sources and isolation points.</p>

          {orderedPoints.length > 0 ? (
            <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm">
              {orderedPoints.map((point) => (
                <li key={point.id}>
                  <span className="font-medium">{point.isolationNumber}</span>
                  {point.description ? ` — ${point.description}` : null}
                  {point.verificationRequired ? (
                    <span className="ml-2 text-xs text-muted-foreground">(verification required)</span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">No isolation points configured yet.</p>
          )}

          {editable ? (
            <form onSubmit={handleAddIsolationPoint} className="flex flex-col gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Isolation number</span>
                <input
                  required
                  value={isolationNumber}
                  onChange={(e) => setIsolationNumber(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Machinery</span>
                <select
                  required
                  value={machineryId}
                  onChange={(e) => setMachineryId(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select machinery</option>
                  {machinery.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Energy source type</span>
                <input
                  value={energySourceType}
                  onChange={(e) => setEnergySourceType(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Description (optional)</span>
                <textarea
                  value={isolationDescription}
                  onChange={(e) => setIsolationDescription(e.target.value)}
                  rows={2}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                Add isolation point
              </Button>
            </form>
          ) : null}
        </div>

        <div className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-medium">Personnel assignment</h2>
          <p className="mb-4 text-sm text-muted-foreground">Assign isolation officers and verifiers.</p>

          {assignments.length > 0 ? (
            <ul className="mb-4 space-y-2 text-sm">
              {assignments.map((item) => {
                const person = workforce.find((entry) => entry.id === item.workforceUserId);
                return (
                  <li key={item.id} className="rounded-md bg-muted/50 px-3 py-2">
                    <span className="font-medium">{item.role.replaceAll("_", " ")}</span>
                    {" · "}
                    {person?.name ?? `${item.workforceUserId.slice(0, 8)}…`}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">No personnel assigned yet.</p>
          )}

          {editable ? (
            <form onSubmit={handleAssignPersonnel} className="flex flex-col gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Workforce member</span>
                <select
                  required
                  value={workforceUserId}
                  onChange={(e) => setWorkforceUserId(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select workforce member</option>
                  {workforce.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Role</span>
                <select
                  value={assignmentRole}
                  onChange={(e) => setAssignmentRole(e.target.value as LototoAssignmentRole)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="isolation_officer">Isolation officer</option>
                  <option value="verifier">Verifier</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </label>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                Assign personnel
              </Button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-medium">Isolation sequence</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {sequence.length > 0
            ? `${sequence.length} step(s) configured. Order follows the isolation points list.`
            : "Order follows the isolation points list. Saving marks the plan Ready."}
        </p>
        {editable ? (
          <Button onClick={handleSaveSequence} disabled={isSubmitting || isolationPoints.length === 0}>
            Save sequence
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Plan is locked for editing.</p>
        )}
      </section>

      {plan.status === "ready" || plan.status === "in_execution" ? (
        <section className="rounded-lg border border-border p-4">
          <h2 className="text-lg font-medium">Isolation execution</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Execute the configured isolation sequence in the field.
          </p>
          <Link href={`/lototo/execute/${plan.id}`}>
            <Button>{plan.status === "ready" ? "Start isolation" : "Continue execution"}</Button>
          </Link>
        </section>
      ) : null}
    </main>
  );
}
