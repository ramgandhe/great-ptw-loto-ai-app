"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { closeIncident, verifyIncident } from "@/lib/incidents/api";
import type { IncidentStatus } from "@/lib/incidents/types";
import { Button } from "@/components/ui/button";

type IncidentClosureWorkflowProps = {
  incidentId: string;
  status: IncidentStatus;
  hasVerification?: boolean;
  investigationCompleted?: boolean;
  onUpdated: () => void | Promise<void>;
};

export function IncidentClosureWorkflow({
  incidentId,
  status,
  hasVerification = false,
  investigationCompleted = false,
  onUpdated,
}: IncidentClosureWorkflowProps) {
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifiedLocally, setVerifiedLocally] = useState(false);

  const isVerified =
    status === "verified" ||
    hasVerification ||
    investigationCompleted ||
    verifiedLocally;
  const canVerify =
    !isVerified &&
    (status === "investigating" || status === "pending_verification");
  const canClose = isVerified && status !== "closed";

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
      await onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-lg font-medium">Verification & closure</h2>

      {status === "open" ? (
        <p className="text-sm text-muted-foreground">
          Assign an investigation above before this incident can be verified and closed.
        </p>
      ) : null}

      {isVerified ? (
        <p className="text-sm text-muted-foreground">
          Investigation verified. Close the incident to archive the record.
        </p>
      ) : canVerify ? (
        <p className="text-sm text-muted-foreground">
          Confirm corrective and preventive actions are complete, then verify before closing.
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {(canVerify || canClose) && (
        <textarea
          className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Comments"
        />
      )}

      {canVerify ? (
        <Button
          disabled={isSubmitting}
          onClick={() =>
            runAction(async () => {
              await verifyIncident(incidentId, {
                correctiveActionsConfirmed: true,
                preventiveActionsReviewed: true,
                comments: comments.trim() || undefined,
              });
              setVerifiedLocally(true);
            })
          }
        >
          Verify incident
        </Button>
      ) : null}

      {canClose ? (
        <Button
          disabled={isSubmitting}
          onClick={() =>
            runAction(() =>
              closeIncident(incidentId, { comments: comments.trim() || undefined }),
            )
          }
        >
          Close incident
        </Button>
      ) : null}
    </section>
  );
}
