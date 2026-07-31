import type { ConflictParticipant } from "@/lib/simops/types";

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

export function ConflictTimeline({ participants }: { participants: ConflictParticipant[] }) {
  return (
    <div className="space-y-3">
      {participants.map((participant) => (
        <div key={participant.id} className="rounded-lg border border-border p-4">
          <p className="font-medium">{participant.permit.title}</p>
          <p className="text-xs text-muted-foreground">
            {participant.permit.reference ?? participant.permit.id.slice(0, 8)} ·{" "}
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
