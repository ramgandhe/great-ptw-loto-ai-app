"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { acceptHandover, cancelHandover, rejectHandover } from "@/lib/multi-day/api";
import type { ShiftHandoverRecord } from "@/lib/multi-day/types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type HandoverListProps = {
  permitId: string;
  handovers: ShiftHandoverRecord[];
  onChanged: () => void;
  currentUserId?: string;
};

function statusLabel(status: ShiftHandoverRecord["status"]) {
  if (status === "pending_acceptance") return "Pending acceptance";
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export function HandoverList({ permitId, handovers, onChanged, currentUserId }: HandoverListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [lototoAckById, setLototoAckById] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function decide(handoverId: string, decision: "accept" | "reject") {
    setBusyId(handoverId);
    setError(null);
    try {
      const notes = notesById[handoverId]?.trim() || undefined;
      if (decision === "accept") {
        await acceptHandover(permitId, handoverId, {
          notes,
          lototoCustodyAcknowledged: lototoAckById[handoverId] === true ? true : undefined,
        });
        toast("Handover accepted");
      } else {
        await rejectHandover(permitId, handoverId, { notes });
        toast("Handover rejected");
      }
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update handover");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(handoverId: string) {
    setBusyId(handoverId);
    setError(null);
    try {
      await cancelHandover(permitId, handoverId);
      toast("Handover cancelled. You can select another assigned executor.");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel handover");
    } finally {
      setBusyId(null);
    }
  }

  if (handovers.length === 0) {
    return <p className="text-sm text-muted-foreground">No handovers recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      <ul className="space-y-3 text-sm">
        {handovers.map((handover) => {
          const pending = handover.status === "pending_acceptance";
          const canDecide = pending && handover.incomingUserId === currentUserId;
          const canCancel = pending && handover.outgoingUserId === currentUserId;
          return (
            <li key={handover.id} className="rounded-md border border-border px-3 py-2 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{formatDateTime(handover.handedOverAt)}</p>
                <p className="text-muted-foreground">{statusLabel(handover.status)}</p>
              </div>
              <p className="text-muted-foreground">{handover.completedActivities}</p>
              {pending ? (
                <p className="text-xs text-muted-foreground">
                  Custody remains with outgoing party until accepted.
                </p>
              ) : null}
              {canDecide ? (
                <div className="space-y-2 border-t border-border pt-2">
                  <label className="block text-sm">
                    Acceptance notes
                    <textarea
                      className="mt-1 min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={notesById[handover.id] ?? ""}
                      onChange={(event) =>
                        setNotesById((prev) => ({ ...prev, [handover.id]: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={lototoAckById[handover.id] === true}
                      onChange={(event) =>
                        setLototoAckById((prev) => ({
                          ...prev,
                          [handover.id]: event.target.checked,
                        }))
                      }
                    />
                    Acknowledge LOTOTO custody (required when isolations remain open)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busyId === handover.id}
                      onClick={() => void decide(handover.id, "accept")}
                    >
                      {busyId === handover.id ? "Saving…" : "Accept handover"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyId === handover.id}
                      onClick={() => void decide(handover.id, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : canCancel ? (
                <div className="border-t border-border pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === handover.id}
                    onClick={() => void cancel(handover.id)}
                  >
                    {busyId === handover.id ? "Cancelling…" : "Cancel and choose another executor"}
                  </Button>
                </div>
              ) : handover.acceptanceNotes ? (
                <p className="text-xs text-muted-foreground">Notes: {handover.acceptanceNotes}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
