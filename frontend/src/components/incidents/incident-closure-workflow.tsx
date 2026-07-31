"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { closeIncident, verifyIncident } from "@/lib/incidents/api";
import type { IncidentStatus } from "@/lib/incidents/types";
import { Button } from "@/components/ui/button";

type IncidentClosureWorkflowProps = {
  incidentId: string;
  status: IncidentStatus;
  onUpdated: () => void;
};

export function IncidentClosureWorkflow({
  incidentId,
  status,
  onUpdated,
}: IncidentClosureWorkflowProps) {
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === "closed") {
    return (
      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-medium">Closure</h2>
        <p className="mt-2 text-sm text-muted-foreground">This incident is closed.</p>
      </section>
    );
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
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-lg font-medium">Verification & closure</h2>
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <textarea
        className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Comments"
      />
      {status === "investigating" || status === "pending_verification" ? (
        <Button
          disabled={isSubmitting}
          onClick={() =>
            runAction(() =>
              verifyIncident(incidentId, {
                correctiveActionsConfirmed: true,
                preventiveActionsReviewed: true,
                comments: comments.trim() || undefined,
              }),
            )
          }
        >
          Verify incident
        </Button>
      ) : null}
      {status === "verified" || status === "pending_verification" ? (
        <Button
          variant="outline"
          disabled={isSubmitting}
          onClick={() =>
            runAction(() => closeIncident(incidentId, { comments: comments.trim() || undefined }))
          }
        >
          Close incident
        </Button>
      ) : null}
    </section>
  );
}
