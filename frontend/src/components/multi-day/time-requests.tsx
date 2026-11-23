"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  approveExtension,
  approveOvertime,
  listPendingTimeRequests,
  rejectExtension,
  rejectOvertime,
  requestExtension,
  requestOvertime,
} from "@/lib/multi-day/api";
import type { PendingTimeRequests } from "@/lib/multi-day/types";
import { Button } from "@/components/ui/button";
import { VerificationEvidenceCapture } from "@/components/common/verification-evidence-capture";

type TimeRequestsProps = {
  permitId: string;
  onUpdated?: () => void;
};

export function TimeRequests({ permitId, onUpdated }: TimeRequestsProps) {
  const [requestedEndAt, setRequestedEndAt] = useState("");
  const [justification, setJustification] = useState("");
  const [extensionEvidence, setExtensionEvidence] = useState<File | null>(null);
  const [overtimeUntil, setOvertimeUntil] = useState("");
  const [overtimeJustification, setOvertimeJustification] = useState("");
  const [pending, setPending] = useState<PendingTimeRequests>({ extensions: [], overtime: [] });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPending = useCallback(() => {
    listPendingTimeRequests()
      .then((rows) =>
        setPending({
          extensions: rows.extensions.filter((row) => row.permitId === permitId),
          overtime: rows.overtime.filter((row) => row.permitId === permitId),
        }),
      )
      .catch(() => setPending({ extensions: [], overtime: [] }));
  }, [permitId]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function runAction(action: () => Promise<unknown>, success: string) {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      onUpdated?.();
      loadPending();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section id="time-requests" className="grid gap-4">
      <h2 className="text-sm font-semibold">Time requests</h2>
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-sm font-medium">Same-day overtime</h3>
        <p className="text-sm text-muted-foreground">
          Past cut-off on today’s operational date only. This does not extend the permit’s end date.
        </p>
        <label className="block text-sm">
          Work until
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={overtimeUntil}
            onChange={(event) => setOvertimeUntil(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          Justification
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={overtimeJustification}
            onChange={(event) => setOvertimeJustification(event.target.value)}
          />
        </label>
        <Button
          disabled={isSubmitting || !overtimeUntil || !overtimeJustification.trim()}
          onClick={() =>
            runAction(
              () =>
                requestOvertime(permitId, {
                  requestedUntil: new Date(overtimeUntil).toISOString(),
                  justification: overtimeJustification.trim(),
                }),
              "Overtime requested",
            )
          }
        >
          Request overtime
        </Button>
      </div>
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-sm font-medium">Request extension</h3>
        <p className="text-sm text-muted-foreground">
          Updates the planned end after approval. Past the tenant maximum requires renewal instead.
        </p>
        <label className="block text-sm">
          Requested end
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={requestedEndAt}
            onChange={(event) => setRequestedEndAt(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          Justification
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
          />
        </label>
        <VerificationEvidenceCapture
          visible={Boolean(justification.trim() || requestedEndAt)}
          label="Extension justification evidence"
          file={extensionEvidence}
          onFileChange={setExtensionEvidence}
          disabled={isSubmitting}
        />
        <Button
          disabled={isSubmitting || !requestedEndAt || !justification.trim()}
          onClick={() =>
            runAction(
              () =>
                requestExtension(permitId, {
                  requestedEndAt: new Date(requestedEndAt).toISOString(),
                  justification: justification.trim(),
                }),
              "Extension requested",
            )
          }
        >
          Request extension
        </Button>
      </div>
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-sm font-medium">Pending for this permit</h3>
        {pending.overtime.length === 0 && pending.extensions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending time requests.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {pending.overtime.map((row) => (
              <li key={row.id} className="rounded-md border border-border px-3 py-2 space-y-2">
                <p className="font-medium">Overtime until {new Date(row.requestedUntil).toLocaleString()}</p>
                <p className="text-muted-foreground">{row.justification}</p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={isSubmitting} onClick={() => runAction(() => approveOvertime(row.id), "Overtime approved")}>
                    Approve
                  </Button>
                  <Button variant="outline" disabled={isSubmitting} onClick={() => runAction(() => rejectOvertime(row.id), "Overtime rejected")}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
            {pending.extensions.map((row) => (
              <li key={row.id} className="rounded-md border border-border px-3 py-2 space-y-2">
                <p className="font-medium">Extension to {new Date(row.requestedEndAt).toLocaleString()}</p>
                <p className="text-muted-foreground">{row.justification}</p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={isSubmitting} onClick={() => runAction(() => approveExtension(row.id), "Extension approved")}>
                    Approve
                  </Button>
                  <Button variant="outline" disabled={isSubmitting} onClick={() => runAction(() => rejectExtension(row.id), "Extension rejected")}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
