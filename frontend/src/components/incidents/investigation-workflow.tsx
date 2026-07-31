"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  assignInvestigation,
  createCorrectiveAction,
  createPreventiveAction,
  recordRootCause,
  updateCorrectiveAction,
} from "@/lib/incidents/api";
import type { InvestigationDetail } from "@/lib/incidents/types";
import { formatWorkforceOptionLabel } from "@/lib/form-options";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { SelectField } from "@/components/lototo/select-field";
import { Button } from "@/components/ui/button";

type InvestigationWorkflowProps = {
  incidentId: string;
  detail: InvestigationDetail | null;
  onUpdated: () => void;
};

export function InvestigationWorkflow({ incidentId, detail, onUpdated }: InvestigationWorkflowProps) {
  const [directory, setDirectory] = useState<WorkforceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [investigatorId, setInvestigatorId] = useState("");
  const [rootCauseDescription, setRootCauseDescription] = useState("");
  const [correctiveTitle, setCorrectiveTitle] = useState("");
  const [correctiveOwnerId, setCorrectiveOwnerId] = useState("");
  const [correctiveDueDate, setCorrectiveDueDate] = useState("");
  const [preventiveTitle, setPreventiveTitle] = useState("");
  const [preventiveOwnerId, setPreventiveOwnerId] = useState("");

  useEffect(() => {
    listWorkforceDirectory()
      .then(setDirectory)
      .catch(() => setDirectory([]));
  }, []);

  const personOptions = useMemo(
    () =>
      directory.map((person) => ({
        value: person.id,
        label: formatWorkforceOptionLabel(person),
      })),
    [directory],
  );

  const personById = useMemo(
    () => new Map(directory.map((person) => [person.id, person])),
    [directory],
  );

  function personLabel(id: string) {
    const person = personById.get(id);
    return person ? formatWorkforceOptionLabel(person) : id;
  }

  async function runAction(action: () => Promise<unknown>) {
    setIsSubmitting(true);
    setError(null);
    try {
      await action();
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <h2 className="text-lg font-medium">Investigation</h2>
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!detail ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose a workforce member to lead the investigation.
          </p>
          {directory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workforce members found. Add employees or contractors under Workforce first.
            </p>
          ) : (
            <SelectField
              id="incident-investigator"
              label="Investigator"
              hint="Workforce member responsible for the investigation."
              value={investigatorId}
              options={personOptions}
              placeholder="Select investigator"
              required
              onChange={setInvestigatorId}
            />
          )}
          <Button
            disabled={isSubmitting || !investigatorId}
            onClick={() =>
              runAction(() => assignInvestigation(incidentId, { investigatorId }))
            }
          >
            Assign investigation
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Investigator {personLabel(detail.investigation.investigatorId)} ·{" "}
            {detail.investigation.status.replace(/_/g, " ")}
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Root cause</h3>
            <textarea
              className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={rootCauseDescription}
              onChange={(e) => setRootCauseDescription(e.target.value)}
              placeholder="Describe root cause"
            />
            <Button
              variant="outline"
              disabled={isSubmitting || !rootCauseDescription.trim()}
              onClick={() =>
                runAction(() =>
                  recordRootCause(incidentId, { description: rootCauseDescription.trim() }),
                )
              }
            >
              Record root cause
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Corrective action</h3>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Title"
              value={correctiveTitle}
              onChange={(e) => setCorrectiveTitle(e.target.value)}
            />
            <SelectField
              id="corrective-action-owner"
              label="Owner"
              value={correctiveOwnerId}
              options={personOptions}
              placeholder="Select owner"
              onChange={setCorrectiveOwnerId}
            />
            <input
              type="date"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={correctiveDueDate}
              onChange={(e) => setCorrectiveDueDate(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={isSubmitting || !correctiveTitle.trim() || !correctiveOwnerId || !correctiveDueDate}
              onClick={() =>
                runAction(() =>
                  createCorrectiveAction(incidentId, {
                    title: correctiveTitle.trim(),
                    ownerId: correctiveOwnerId,
                    dueDate: new Date(correctiveDueDate).toISOString(),
                  }),
                )
              }
            >
              Add corrective action
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Preventive action</h3>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Title"
              value={preventiveTitle}
              onChange={(e) => setPreventiveTitle(e.target.value)}
            />
            <SelectField
              id="preventive-action-owner"
              label="Owner"
              value={preventiveOwnerId}
              options={personOptions}
              placeholder="Select owner"
              onChange={setPreventiveOwnerId}
            />
            <Button
              variant="outline"
              disabled={isSubmitting || !preventiveTitle.trim() || !preventiveOwnerId}
              onClick={() =>
                runAction(() =>
                  createPreventiveAction(incidentId, {
                    title: preventiveTitle.trim(),
                    ownerId: preventiveOwnerId,
                  }),
                )
              }
            >
              Add preventive action
            </Button>
          </div>

          {detail.correctiveActions.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {detail.correctiveActions.map((action) => (
                <li key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2">
                  <span>
                    {action.title}
                    <span className="block text-xs text-muted-foreground">
                      Owner: {personLabel(action.ownerId)}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSubmitting || action.status === "completed"}
                    onClick={() =>
                      runAction(() => updateCorrectiveAction(action.id, { status: "completed" }))
                    }
                  >
                    Mark complete
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
