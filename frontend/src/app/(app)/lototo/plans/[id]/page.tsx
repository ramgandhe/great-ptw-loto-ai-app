"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { machineryApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import {
  addIsolationPoint,
  assignLototoPersonnel,
  configureIsolationSequence,
  listLototoPlans,
} from "@/lib/lototo/api";
import type {
  IsolationPoint,
  LototoAssignment,
  LototoAssignmentRole,
  LototoPlan,
} from "@/lib/lototo/types";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { PlanStatusBadge } from "@/components/lototo/plan-status-badge";
import { Button } from "@/components/ui/button";

type LocalIsolationPoint = IsolationPoint & { localKey: string };

export default function LototoPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const planId = params.id;

  const [plan, setPlan] = useState<LototoPlan | null>(null);
  const [machinery, setMachinery] = useState<OrgRecord[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceRecord[]>([]);
  const [isolationPoints, setIsolationPoints] = useState<LocalIsolationPoint[]>([]);
  const [assignments, setAssignments] = useState<LototoAssignment[]>([]);
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

  async function loadPlan() {
    const plans = await listLototoPlans();
    const match = plans.find((item) => item.id === planId) ?? null;
    setPlan(match);
    if (!match) {
      throw new ApiError("LOTOTO plan not found");
    }
  }

  useEffect(() => {
    Promise.all([loadPlan(), machineryApi.list(), listWorkforceDirectory()])
      .then(([, mc, directory]) => {
        setMachinery(mc);
        setWorkforce(directory);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load plan");
      });
  }, [planId]);

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
      const point = await addIsolationPoint(planId, {
        machineryId,
        isolationNumber: isolationNumber.trim(),
        description: isolationDescription.trim() || undefined,
        verificationRequired: true,
        energySource: {
          energySourceType,
        },
      });
      setIsolationPoints((current) => [...current, { ...point, localKey: point.id }]);
      setIsolationNumber("");
      setIsolationDescription("");
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
      const assignment = await assignLototoPersonnel(planId, {
        workforceUserId,
        role: assignmentRole,
      });
      setAssignments((current) => [...current, assignment]);
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
      setMessage("Isolation sequence saved.");
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
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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

          {isolationPoints.length > 0 ? (
            <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm">
              {isolationPoints.map((point) => (
                <li key={point.localKey}>
                  <span className="font-medium">{point.isolationNumber}</span>
                  {point.description ? ` — ${point.description}` : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">No isolation points configured yet.</p>
          )}

          {editable ? (
            <form onSubmit={handleAddIsolationPoint} className="flex flex-col gap-3">
              <input
                required
                value={isolationNumber}
                onChange={(e) => setIsolationNumber(e.target.value)}
                placeholder="Isolation number"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
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
              <input
                value={energySourceType}
                onChange={(e) => setEnergySourceType(e.target.value)}
                placeholder="Energy source type"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={isolationDescription}
                onChange={(e) => setIsolationDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
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
              {assignments.map((item) => (
                <li key={item.id} className="rounded-md bg-muted/50 px-3 py-2">
                  {item.role.replace("_", " ")} · {item.workforceUserId.slice(0, 8)}…
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">No personnel assigned yet.</p>
          )}

          {editable ? (
            <form onSubmit={handleAssignPersonnel} className="flex flex-col gap-3">
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
              <select
                value={assignmentRole}
                onChange={(e) => setAssignmentRole(e.target.value as LototoAssignmentRole)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="isolation_officer">Isolation officer</option>
                <option value="verifier">Verifier</option>
                <option value="supervisor">Supervisor</option>
              </select>
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
          Order follows the list above. Reorder by adding points in the desired sequence.
        </p>
        {editable ? (
          <Button onClick={handleSaveSequence} disabled={isSubmitting || isolationPoints.length === 0}>
            Save sequence
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Plan is locked for editing.</p>
        )}
      </section>
    </main>
  );
}
