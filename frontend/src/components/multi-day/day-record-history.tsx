import type { ReactNode } from "react";
import type { DaySecureRecord, RevalidationHistoryEvent, ShiftHandoverRecord } from "@/lib/multi-day/types";
import type { WorkHistoryEvent } from "@/lib/execution/types";

type DayRecordHistoryProps = {
  pauses: WorkHistoryEvent[];
  secures: DaySecureRecord[];
  reopens: RevalidationHistoryEvent[];
  handovers: ShiftHandoverRecord[];
};

export function DayRecordHistory({ pauses, secures, reopens, handovers }: DayRecordHistoryProps) {
  const reopenRows = reopens.filter(
    (event) => event.eventType === "revalidation_passed" || event.eventType === "revalidation_failed",
  );

  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold">Day records</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <RecordList title="Pauses" empty="No pauses yet." count={pauses.length}>
          {pauses.map((row) => (
            <li key={row.id}>
              {row.at.slice(0, 16).replace("T", " ")} · {row.summary || "Paused"}
            </li>
          ))}
        </RecordList>
        <RecordList title="Day secures" empty="No day secures yet." count={secures.length}>
          {secures.map((row) => (
            <li key={row.id}>
              {row.operationalDate} · {row.late ? "Late" : "On time"} · {row.status}
              {row.notes ? ` · ${row.notes}` : ""}
            </li>
          ))}
        </RecordList>
        <RecordList title="Reopens" empty="No reopens yet." count={reopenRows.length}>
          {reopenRows.map((row) => (
            <li key={row.id}>
              {typeof row.payload?.operationalDate === "string" ? row.payload.operationalDate : row.createdAt.slice(0, 10)}
              {" · "}
              {row.eventType === "revalidation_passed" ? "Passed" : "Failed"}
            </li>
          ))}
        </RecordList>
        <RecordList title="Handovers" empty="No handovers yet." count={handovers.length}>
          {handovers.map((row) => (
            <li key={row.id}>
              {row.status} · to {row.incomingUserId}
            </li>
          ))}
        </RecordList>
      </div>
    </section>
  );
}

function RecordList({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm text-muted-foreground">{children}</ul>
      )}
    </div>
  );
}
