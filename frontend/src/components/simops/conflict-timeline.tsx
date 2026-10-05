import Link from "next/link";
import type { ConflictParticipant } from "@/lib/simops/types";
import { formatWindow } from "@/lib/format";
import { workspaceHref } from "@/lib/permit/workspace-tabs";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { sharedWindow } from "@/lib/simops/overlap";

/** The clashing permits side by side, with the time they share. */
export function ConflictTimeline({ participants }: { participants: ConflictParticipant[] }) {
  const overlap = sharedWindow(participants);
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        <span className="font-medium">Overlap: </span>
        {overlap ? formatWindow(overlap.start, overlap.end) : "The planned windows do not overlap, or one is not scheduled."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {participants.map((participant) => (
          <div key={participant.id} className="grid gap-1.5 rounded-xl border border-border bg-card p-4">
            <Link href={workspaceHref(participant.permit.id)} className="font-semibold text-primary hover:underline">
              {participant.permit.title}
            </Link>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {participant.permit.reference ? <span className="font-mono">{participant.permit.reference}</span> : null}
              <PermitStatusBadge status={participant.permit.status} />
            </p>
            <p className="text-sm text-muted-foreground">{formatWindow(participant.permit.plannedStartAt, participant.permit.plannedEndAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
