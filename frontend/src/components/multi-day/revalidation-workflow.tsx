"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import {
  acceptRenewal,
  approveExtension,
  continuePermit,
  createRenewal,
  rejectExtension,
  rejectRenewal,
  requestExtension,
  revalidatePermit,
  submitRenewal,
  suspendPermitForRevalidation,
} from "@/lib/multi-day/api";
import type { PermitExtension, PermitRenewal, RevalidationOutcome } from "@/lib/multi-day/types";
import { Button } from "@/components/ui/button";

type RevalidationWorkflowProps = {
  permitId: string;
  permitStatus: string;
  onUpdated: () => void;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function RevalidationWorkflow({
  permitId,
  permitStatus,
  onUpdated,
}: RevalidationWorkflowProps) {
  const [operationalDate, setOperationalDate] = useState(todayIsoDate());
  const [outcome, setOutcome] = useState<RevalidationOutcome>("passed");
  const [findings, setFindings] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [requestedEndAt, setRequestedEndAt] = useState("");
  const [justification, setJustification] = useState("");
  const [extensionId, setExtensionId] = useState("");
  const [decisionComments, setDecisionComments] = useState("");
  const [lastExtension, setLastExtension] = useState<PermitExtension | null>(null);
  const [renewalId, setRenewalId] = useState("");
  const [lastRenewal, setLastRenewal] = useState<PermitRenewal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function runAction(action: () => Promise<unknown>, success: string) {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-lg font-medium">Daily revalidation</h2>
        <label className="block text-sm">
          Operational date
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={operationalDate}
            onChange={(event) => setOperationalDate(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          Outcome
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as RevalidationOutcome)}
          >
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label className="block text-sm">
          Findings
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={findings}
            onChange={(event) => setFindings(event.target.value)}
          />
        </label>
        <Button
          disabled={isSubmitting || !findings.trim()}
          onClick={() =>
            runAction(
              () =>
                revalidatePermit(permitId, {
                  operationalDate,
                  outcome,
                  findings: findings.trim(),
                }),
              "Revalidation recorded",
            )
          }
        >
          Submit revalidation
        </Button>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-lg font-medium">Continue permit</h2>
        <p className="text-sm text-muted-foreground">
          Current status: {permitStatus}. Continuation requires a passed revalidation for today
          (server timezone). Expired permits are blocked.
        </p>
        <Button
          variant="outline"
          disabled={isSubmitting}
          onClick={() => runAction(() => continuePermit(permitId), "Permit continued")}
        >
          Continue work
        </Button>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-lg font-medium">Suspend permit</h2>
        <label className="block text-sm">
          Reason
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={suspendReason}
            onChange={(event) => setSuspendReason(event.target.value)}
          />
        </label>
        <Button
          variant="outline"
          disabled={isSubmitting || !suspendReason.trim()}
          onClick={() =>
            runAction(
              () => suspendPermitForRevalidation(permitId, suspendReason.trim()),
              "Permit suspended",
            )
          }
        >
          Suspend permit
        </Button>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-lg font-medium">Request extension</h2>
        <label className="block text-sm">
          Requested end
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={requestedEndAt}
            onChange={(event) => setRequestedEndAt(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          Justification
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
          />
        </label>
        <Button
          disabled={isSubmitting || !requestedEndAt || !justification.trim()}
          onClick={() =>
            runAction(async () => {
              const extension = await requestExtension(permitId, {
                requestedEndAt: new Date(requestedEndAt).toISOString(),
                justification: justification.trim(),
              });
              setLastExtension(extension);
              setExtensionId(extension.id);
            }, "Extension requested")
          }
        >
          Request extension
        </Button>
        {lastExtension?.status === "pending" ? (
          <p className="text-xs text-muted-foreground">Pending extension ID: {lastExtension.id}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-lg font-medium">Decide extension</h2>
        <label className="block text-sm">
          Extension ID
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={extensionId}
            onChange={(event) => setExtensionId(event.target.value)}
            placeholder="Paste extension ID from history or request response"
          />
        </label>
        <label className="block text-sm">
          Comments
          <textarea
            className="mt-1 min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={decisionComments}
            onChange={(event) => setDecisionComments(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isSubmitting || !extensionId}
            onClick={() =>
              runAction(
                () => approveExtension(extensionId, { comments: decisionComments.trim() || undefined }),
                "Extension approved",
              )
            }
          >
            Approve
          </Button>
          <Button
            variant="outline"
            disabled={isSubmitting || !extensionId}
            onClick={() =>
              runAction(
                () => rejectExtension(extensionId, { comments: decisionComments.trim() || undefined }),
                "Extension rejected",
              )
            }
          >
            Reject
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-lg font-medium">Permit renewal (FR-MDP-009)</h2>
        <p className="text-sm text-muted-foreground">
          Copies template from the source permit. Update schedule/hazards/PPE on the renewal draft,
          then submit for HOD approval.
        </p>
        <Button
          disabled={isSubmitting}
          onClick={() =>
            runAction(async () => {
              const result = await createRenewal(permitId);
              setLastRenewal(result.renewal);
              setRenewalId(result.renewal.id);
            }, "Renewal draft created")
          }
        >
          Create renewal draft
        </Button>
        <label className="block text-sm">
          Renewal ID
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={renewalId}
            onChange={(event) => setRenewalId(event.target.value)}
            placeholder="Paste renewal ID"
          />
        </label>
        {lastRenewal ? (
          <p className="text-xs text-muted-foreground">
            Last renewal: {lastRenewal.id} ({lastRenewal.status}) → permit {lastRenewal.renewalPermitId}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={isSubmitting || !renewalId}
            onClick={() => runAction(() => submitRenewal(renewalId), "Renewal submitted to HOD")}
          >
            Submit to HOD
          </Button>
          <Button
            disabled={isSubmitting || !renewalId}
            onClick={() =>
              runAction(
                () => acceptRenewal(renewalId, { comments: decisionComments.trim() || undefined }),
                "Renewal accepted",
              )
            }
          >
            Accept
          </Button>
          <Button
            variant="outline"
            disabled={isSubmitting || !renewalId}
            onClick={() =>
              runAction(
                () => rejectRenewal(renewalId, { comments: decisionComments.trim() || undefined }),
                "Renewal rejected",
              )
            }
          >
            Reject
          </Button>
        </div>
      </div>
    </section>
  );
}
