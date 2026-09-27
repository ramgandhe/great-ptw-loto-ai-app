import Link from "next/link";
import type { ConflictParticipant } from "@/lib/simops/types";
import { formatDateTime } from "@/lib/format";

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return formatDateTime(value);
}

export function ConflictTimeline({ participants }: { participants: ConflictParticipant[] }) {
  return (
    <div className="space-y-3">
      {participants.map((participant) => (
        <div key={participant.id} className="rounded-lg border border-border p-4">
          <Link href={`/permits/${participant.permit.id}`} className="font-medium text-primary hover:underline">
            {participant.permit.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {participant.permit.reference ?? participant.permit.title} ·{" "}
            {participant.permit.status.replace(/_/g, " ")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDate(participant.permit.plannedStartAt)} →{" "}
            {formatDate(participant.permit.plannedEndAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
