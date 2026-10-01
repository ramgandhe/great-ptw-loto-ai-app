import type { ConflictParticipant } from "./types";

/** When every clashing permit is planned at once; null when the plans leave no shared time. */
export function sharedWindow(participants: ConflictParticipant[]): { start: string; end: string } | null {
  const starts = participants.map((p) => p.permit.plannedStartAt).filter((v): v is string => Boolean(v));
  const ends = participants.map((p) => p.permit.plannedEndAt).filter((v): v is string => Boolean(v));
  if (starts.length !== participants.length || ends.length !== participants.length) return null;
  const start = starts.reduce((a, b) => (a > b ? a : b));
  const end = ends.reduce((a, b) => (a < b ? a : b));
  return start < end ? { start, end } : null;
}
