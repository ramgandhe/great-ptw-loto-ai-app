"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { closeIncident, verifyIncident } from "@/lib/incidents/api";
import type { IncidentStatus } from "@/lib/incidents/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { INCIDENT_CLOSE_ROLES, INCIDENT_VERIFY_ROLES } from "@/lib/auth/roles";

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
  const { roles } = useAuthProfile();
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
    (status === "investigating" || status === "pending_verification") &&
    hasAnyRole(roles, INCIDENT_VERIFY_ROLES);
  const canClose = isVerified && status !== "closed" && hasAnyRole(roles, INCIDENT_CLOSE_ROLES);

  if (status === "closed") {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-heading text-lg font-semibold">Closed</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This incident is closed and archived. It is listed under Incidents › Closed.
        </p>
      </section>
    );
  }

  async function runAction(action: () => Promise<unknown>, done: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      await action();
      toast(done);
      await onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-heading text-lg font-semibold">Verification and closure</h2>

      {status === "open" ? (
        <p className="text-sm text-muted-foreground">
          Assign an investigator above before this incident can be verified and closed.
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
            }, "Incident verified")
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
              "Incident closed and archived",
            )
          }
        >
          Close incident
        </Button>
      ) : null}
    </section>
  );
}
