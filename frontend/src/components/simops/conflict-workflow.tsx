"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import {
  acknowledgeDepartmentSimopsConflict,
  acknowledgeLowSimopsConflict,
  approveSimopsConflict,
  assessSimopsConflict,
  createMitigationPlan,
  rejectSimopsConflict,
} from "@/lib/simops/api";
import type { ConflictDetail, ConflictSeverity } from "@/lib/simops/types";
import { Button } from "@/components/ui/button";

type ConflictWorkflowProps = {
  detail: ConflictDetail;
  onUpdated: () => void;
};

const SEVERITIES: ConflictSeverity[] = ["low", "medium", "high"];

export function ConflictWorkflow({ detail, onUpdated }: ConflictWorkflowProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessedSeverity, setAssessedSeverity] = useState<ConflictSeverity>(
    detail.assessment?.assessedSeverity ?? detail.conflict.severity,
  );
  const [riskSummary, setRiskSummary] = useState(detail.assessment?.riskSummary ?? "");
  const [planSummary, setPlanSummary] = useState(detail.mitigation?.planSummary ?? "");
  const [actionDescription, setActionDescription] = useState(
    detail.mitigation?.actions[0]?.description ?? "",
  );
  const [approvalComments, setApprovalComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [lowAckComments, setLowAckComments] = useState("Low-severity conflict acknowledged");

  const status = detail.conflict.status;
  const isResolved = status === "approved" || status === "rejected";
  const requiresJointAck = Boolean(detail.conflict.requiresJointAck);
  const jointAckComplete = Boolean(detail.conflict.ackUserA && detail.conflict.ackUserB);

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

  if (isResolved) {
    return (
      <section className="rounded-lg border border-border p-4">
        <h2 className="text-lg font-medium">Resolution</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This conflict was {status}. {detail.resolution?.comments}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {detail.conflict.frozenPermitId ? (
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
        >
          Newer permit is on SIMOPS hold until this conflict is resolved.
        </div>
      ) : null}

      {status === "open" && detail.conflict.severity === "low" ? (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-lg font-medium">Low-severity acknowledgment</h2>
          <p className="text-sm text-muted-foreground">
            Job Issuers may acknowledge low-severity conflicts without the full review path.
          </p>
          <label className="block text-sm">
            Comments
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              rows={2}
              value={lowAckComments}
              onChange={(event) => setLowAckComments(event.target.value)}
            />
          </label>
          <Button
            disabled={isSubmitting || !lowAckComments.trim()}
            onClick={() =>
              runAction(() =>
                acknowledgeLowSimopsConflict(detail.conflict.id, lowAckComments.trim()),
              )
            }
          >
            Acknowledge low conflict
          </Button>
        </div>
      ) : null}

      {requiresJointAck && !jointAckComplete ? (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-lg font-medium">Cross-department acknowledgment</h2>
          <p className="text-sm text-muted-foreground">
            Both departments must acknowledge before approval.
            {detail.conflict.ackUserA ? " First acknowledgment recorded." : ""}
            {detail.conflict.ackUserB ? " Second acknowledgment recorded." : ""}
          </p>
          <Button
            disabled={isSubmitting}
            onClick={() =>
              runAction(() => acknowledgeDepartmentSimopsConflict(detail.conflict.id))
            }
          >
            Record department acknowledgment
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-lg font-medium">1. Risk assessment</h2>
        {detail.assessment ? (
          <p className="text-sm text-muted-foreground">{detail.assessment.riskSummary}</p>
        ) : (
          <>
            <label className="block text-sm">
              Severity
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={assessedSeverity}
                onChange={(event) => setAssessedSeverity(event.target.value as ConflictSeverity)}
              >
                {SEVERITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Risk summary
              <textarea
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                rows={3}
                value={riskSummary}
                onChange={(event) => setRiskSummary(event.target.value)}
              />
            </label>
            <Button
              disabled={isSubmitting || !riskSummary.trim()}
              onClick={() =>
                runAction(() =>
                  assessSimopsConflict(detail.conflict.id, {
                    assessedSeverity,
                    riskSummary: riskSummary.trim(),
                  }),
                )
              }
            >
              Save assessment
            </Button>
          </>
        )}
      </div>

      {(status === "assessed" || status === "mitigation_planned") && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-lg font-medium">2. Mitigation plan</h2>
          {detail.mitigation && status === "mitigation_planned" ? (
            <p className="text-sm text-muted-foreground">{detail.mitigation.planSummary}</p>
          ) : (
            <>
              <label className="block text-sm">
                Plan summary
                <textarea
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={2}
                  value={planSummary}
                  onChange={(event) => setPlanSummary(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                Primary action
                <textarea
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={2}
                  value={actionDescription}
                  onChange={(event) => setActionDescription(event.target.value)}
                />
              </label>
              <Button
                disabled={isSubmitting || !planSummary.trim() || !actionDescription.trim()}
                onClick={() =>
                  runAction(() =>
                    createMitigationPlan(detail.conflict.id, {
                      planSummary: planSummary.trim(),
                      actions: [{ description: actionDescription.trim() }],
                    }),
                  )
                }
              >
                Save mitigation plan
              </Button>
            </>
          )}
        </div>
      )}

      {status === "mitigation_planned" && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h2 className="text-lg font-medium">3. Resolution decision</h2>
          <label className="block text-sm">
            Approval comments
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              rows={2}
              value={approvalComments}
              onChange={(event) => setApprovalComments(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isSubmitting || !approvalComments.trim()}
              onClick={() =>
                runAction(() =>
                  approveSimopsConflict(detail.conflict.id, {
                    comments: approvalComments.trim(),
                  }),
                )
              }
            >
              Approve conflict
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
        <h2 className="text-lg font-medium text-destructive">Reject conflict</h2>
        <label className="block text-sm">
          Rejection reason
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={2}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
          />
        </label>
        <Button
          variant="destructive"
          disabled={isSubmitting || !rejectionReason.trim()}
          onClick={() =>
            runAction(() =>
              rejectSimopsConflict(detail.conflict.id, {
                reason: rejectionReason.trim(),
              }),
            )
          }
        >
          Reject and suspend permits
        </Button>
      </div>

      {detail.history.length > 0 ? (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h2 className="text-lg font-medium">Activity</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {detail.history.map((entry) => (
              <li key={entry.id}>
                {entry.action.replace(/_/g, " ")} · {new Date(entry.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
