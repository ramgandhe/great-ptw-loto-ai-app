"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import {
  assignInvestigation,
  createCorrectiveAction,
  createPreventiveAction,
  recordRootCause,
  updateCorrectiveAction,
} from "@/lib/incidents/api";
import type { InvestigationDetail } from "@/lib/incidents/types";
import { Button } from "@/components/ui/button";

type InvestigationWorkflowProps = {
  incidentId: string;
  detail: InvestigationDetail | null;
  onUpdated: () => void;
};

export function InvestigationWorkflow({ incidentId, detail, onUpdated }: InvestigationWorkflowProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [investigatorId, setInvestigatorId] = useState("");
  const [rootCauseDescription, setRootCauseDescription] = useState("");
  const [correctiveTitle, setCorrectiveTitle] = useState("");
  const [correctiveOwnerId, setCorrectiveOwnerId] = useState("");
  const [correctiveDueDate, setCorrectiveDueDate] = useState("");
  const [preventiveTitle, setPreventiveTitle] = useState("");
  const [preventiveOwnerId, setPreventiveOwnerId] = useState("");

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
          <p className="text-sm text-muted-foreground">Assign an investigator to begin.</p>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Investigator user ID"
            value={investigatorId}
            onChange={(e) => setInvestigatorId(e.target.value)}
          />
          <Button
            disabled={isSubmitting || !investigatorId.trim()}
            onClick={() =>
              runAction(() => assignInvestigation(incidentId, { investigatorId: investigatorId.trim() }))
            }
          >
            Assign investigation
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Investigator {detail.investigation.investigatorId} · {detail.investigation.status}
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
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Owner user ID"
              value={correctiveOwnerId}
              onChange={(e) => setCorrectiveOwnerId(e.target.value)}
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
                    ownerId: correctiveOwnerId.trim(),
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
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Owner user ID"
              value={preventiveOwnerId}
              onChange={(e) => setPreventiveOwnerId(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={isSubmitting || !preventiveTitle.trim() || !preventiveOwnerId}
              onClick={() =>
                runAction(() =>
                  createPreventiveAction(incidentId, {
                    title: preventiveTitle.trim(),
                    ownerId: preventiveOwnerId.trim(),
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
                  <span>{action.title}</span>
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
