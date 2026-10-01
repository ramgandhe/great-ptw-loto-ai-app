/**
 * The permit process as a state machine: one node per permit status, one edge per allowed move.
 * Mirrors the guards in the API (permit, approval, execution, closure, revalidation and incident
 * services). Both the process map and the per-permit journey are drawn from this.
 */

import { workspaceHref } from "@/lib/permit/workspace-tabs";

export type LaneId = "issuer" | "executor" | "approvers" | "hod" | "safety" | "system";

export const LANES: { id: LaneId; label: string; roles: string; top: number; height: number }[] = [
  { id: "issuer", label: "Job issuer", roles: "Raises, revises, verifies", top: 0, height: 160 },
  { id: "executor", label: "Job executor", roles: "Site details, does the work", top: 160, height: 110 },
  { id: "approvers", label: "Approvers", roles: "Each workflow stage", top: 270, height: 130 },
  { id: "hod", label: "HOD", roles: "Revalidates, signs off", top: 400, height: 120 },
  { id: "safety", label: "Safety officer", roles: "Suspends, can veto", top: 520, height: 90 },
  { id: "system", label: "System", roles: "Validity, incidents", top: 610, height: 90 },
];

export const PHASES = [
  { label: "Prepare", from: 120, to: 300 },
  { label: "Approve", from: 300, to: 610 },
  { label: "Execute", from: 610, to: 985 },
  { label: "Close", from: 985, to: 1340 },
] as const;

export const MAP_WIDTH = 1340;
export const MAP_HEADER = 36;
export const MAP_HEIGHT = 700 + MAP_HEADER;
export const NODE_W = 140;
export const NODE_H = 52;

export type StageKind = "work" | "decision" | "loop-back" | "hold" | "end" | "event";

export type ProcessNode = {
  id: string;
  title: string;
  lane: LaneId;
  x: number;
  /** Centre y inside the lane area (header offset is added when drawing). */
  y: number;
  kind: StageKind;
  /** Where the permit is, in one sentence. */
  meaning: string;
  /** Who moves it on, in plain words. */
  owner: string;
  /** What that person needs to have or check before moving it on. */
  needs: string[];
  /** What gets recorded at this stage. */
  records: string[];
  /** Screen where the work for this stage is done. */
  screen?: (permitId: string) => string;
};

export const NODES: ProcessNode[] = [
  {
    id: "draft",
    title: "Draft",
    lane: "issuer",
    x: 210,
    y: 80,
    kind: "work",
    meaning: "Being prepared. It goes to approval once the issuer submits it.",
    owner: "Job issuer, with the executor adding on-site details",
    needs: [
      "Permit type, title, location and planned window",
      "Hazards and PPE for the job",
      "Isolations (LOTOTO) and gas tests when the type needs them",
      "At least one executor, one marked primary",
      "Every required answer on the linked forms and check sheets",
    ],
    records: ["Draft autosaves", "Form and check sheet answers", "Attachments"],
    screen: (id) => `/permits/${id}/edit`,
  },
  {
    id: "deferred",
    title: "Deferred",
    lane: "issuer",
    x: 385,
    y: 70,
    kind: "loop-back",
    meaning: "Sent back for changes. The issuer revises and resubmits it.",
    owner: "Job issuer",
    needs: ["Read the approver's comment", "Make the changes asked for"],
    records: ["Approver's deferral comment"],
    screen: (id) => `/permits/${id}/edit`,
  },
  {
    id: "rejected",
    title: "Rejected",
    lane: "issuer",
    x: 540,
    y: 70,
    kind: "loop-back",
    meaning: "Rejected by an approver or stopped by a safety veto. The issuer can revise and resubmit.",
    owner: "Job issuer",
    needs: ["Read the rejection or veto reason", "Fix the cause before resubmitting"],
    records: ["Rejection or veto reason"],
    screen: (id) => `/permits/${id}/edit`,
  },
  {
    id: "pending_approval",
    title: "Pending approval",
    lane: "approvers",
    x: 462,
    y: 55,
    kind: "decision",
    meaning: "Waiting for approval. Each workflow stage decides in order; parallel stages need their quorum.",
    owner: "The approver for the active stage, or their delegate",
    needs: [
      "Review the job, hazards, controls and filled forms",
      "A comment when the stage requires one",
      "Any 'No' answers on the check sheets explained",
    ],
    records: ["Decision per stage, with comment", "Who decided, and on whose behalf", "Stage deadlines (SLA)"],
    screen: (id) => workspaceHref(id, "review"),
  },
  {
    id: "approved",
    title: "Approved",
    lane: "executor",
    x: 700,
    y: 55,
    kind: "hold",
    meaning: "Approved. The executor can start work once isolations are in place.",
    owner: "An assigned executor",
    needs: ["Isolations applied and verified", "Gas test readings in limits, when required", "Crew briefed"],
    records: ["Actual start time", "Who started the work"],
    screen: (id) => workspaceHref(id, "work"),
  },
  {
    id: "active",
    title: "Work in progress",
    lane: "executor",
    x: 900,
    y: 55,
    kind: "work",
    meaning: "Work is in progress on site.",
    owner: "The primary executor",
    needs: [
      "Daily revalidation on multi-day permits",
      "An extension before the planned end, if more time is needed",
      "Completion checklist: work done, procedure followed, LOTOTO and gas tests done",
    ],
    records: ["Progress updates and evidence", "Daily revalidations", "Extension requests"],
    screen: (id) => workspaceHref(id, "work"),
  },
  {
    id: "suspended",
    title: "Suspended",
    lane: "hod",
    x: 720,
    y: 60,
    kind: "hold",
    meaning: "Work is suspended. It needs revalidation, or a resume, before it can restart.",
    owner: "HOD or issuer revalidates; an executor or HOD resumes",
    needs: ["The suspension reason resolved", "Site made safe again"],
    records: ["Suspension reason, who and when", "Resume or revalidation"],
    screen: (id) => workspaceHref(id, "work"),
  },
  {
    id: "execution_completed",
    title: "Work finished",
    lane: "issuer",
    x: 1060,
    y: 80,
    kind: "decision",
    meaning: "Work is finished. The issuer confirms completion next.",
    owner: "Job issuer",
    needs: ["Work completed", "Evidence reviewed", "Area secured", "Hazards removed"],
    records: ["Verification checklist and comment"],
    screen: (id) => workspaceHref(id, "review"),
  },
  {
    id: "pending_closure",
    title: "Final sign-off",
    lane: "hod",
    x: 1060,
    y: 60,
    kind: "decision",
    meaning: "Waiting for the HOD's final sign-off.",
    owner: "HOD, or an organisation admin",
    needs: ["Issuer's verification in place", "Closure checklist complete", "Actual end time"],
    records: ["Closure checklist, comment and actual end"],
    screen: (id) => workspaceHref(id, "review"),
  },
  {
    id: "closed",
    title: "Closed",
    lane: "hod",
    x: 1260,
    y: 60,
    kind: "end",
    meaning: "Closed. The full record is kept for audit.",
    owner: "Nobody. The permit is complete",
    needs: [],
    records: ["Archive copy"],
  },
  {
    id: "veto",
    title: "Safety veto",
    lane: "safety",
    x: 600,
    y: 45,
    kind: "event",
    meaning: "A safety officer can stop a live permit at any point from approval to final sign-off.",
    owner: "Safety officer",
    needs: ["A reason the issuer and approvers will see"],
    records: ["Veto reason and reason code"],
  },
  {
    id: "expired",
    title: "Expired",
    lane: "system",
    x: 870,
    y: 45,
    kind: "end",
    meaning: "The permit window ended before it was closed. A renewal starts a new draft.",
    owner: "Job issuer, by renewing as a new permit",
    needs: [],
    records: ["Validity notices sent before expiry"],
  },
  {
    id: "cancelled",
    title: "Cancelled",
    lane: "system",
    x: 1030,
    y: 45,
    kind: "end",
    meaning: "Cancelled after a serious incident. No further work is allowed under this permit.",
    owner: "Nobody. Raise a new permit after the investigation",
    needs: [],
    records: ["Linked incident"],
  },
];

export type ProcessEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  /** Who can make this move. */
  actor: string;
  /** History actions (approval or status log) that record this move. */
  actions: string[];
  /** Condition or guard the API checks, in plain words. */
  when?: string;
  tone?: "forward" | "back" | "stop";
  /** Bend the curve sideways, in px, to keep two-way pairs apart. */
  bend?: number;
  /** Where along the arrow its label sits, 0 to 1 (default 0.5). */
  labelT?: number;
  dashed?: boolean;
};

export const EDGES: ProcessEdge[] = [
  { id: "submit", labelT: 0.3, from: "draft", to: "pending_approval", label: "Submit", actor: "Job issuer", actions: ["submitted"], when: "Required forms answered", tone: "forward" },
  { id: "resubmit-deferred", labelT: 0.3, from: "deferred", to: "pending_approval", label: "Resubmit", actor: "Job issuer", actions: ["resubmitted"], tone: "forward", bend: -40 },
  { id: "resubmit-rejected", labelT: 0.3, from: "rejected", to: "pending_approval", label: "Resubmit", actor: "Job issuer", actions: ["resubmitted"], tone: "forward", bend: -40 },
  { id: "stage", from: "pending_approval", to: "pending_approval", label: "Next stage", actor: "Stage approver", actions: ["stage_advanced"], when: "More stages remain", tone: "forward" },
  { id: "approve", from: "pending_approval", to: "approved", label: "Final approval", actor: "Last-stage approver", actions: ["approved"], tone: "forward" },
  { id: "defer", labelT: 0.4, from: "pending_approval", to: "deferred", label: "Defer", actor: "Stage approver", actions: ["deferred"], tone: "back", bend: -40 },
  { id: "reject", labelT: 0.4, from: "pending_approval", to: "rejected", label: "Reject", actor: "Stage approver", actions: ["rejected"], tone: "stop", bend: -40 },
  { id: "activate", from: "approved", to: "active", label: "Start work", actor: "Assigned executor", actions: ["activated"], tone: "forward" },
  { id: "suspend-approved", from: "approved", to: "suspended", label: "Suspend", actor: "HOD or safety officer", actions: ["suspended"], tone: "stop" },
  { id: "suspend-active", from: "active", to: "suspended", label: "Suspend", actor: "HOD or safety officer", actions: ["suspended"], tone: "stop", bend: -34 },
  { id: "resume", from: "suspended", to: "active", label: "Resume", actor: "Executor or HOD", actions: ["resumed"], when: "Suspension recorded", tone: "forward", bend: -34 },
  { id: "revalidate", from: "suspended", to: "pending_approval", label: "Revalidate", actor: "HOD or issuer", actions: ["revalidated"], when: "Goes through full approval again", tone: "back" },
  { id: "complete", from: "active", to: "execution_completed", label: "Declare complete", actor: "Primary executor", actions: ["execution_completed"], when: "Completion checklist done", tone: "forward", bend: -34 },
  { id: "send-back-executor", from: "execution_completed", to: "active", label: "Send back", actor: "Job issuer", actions: ["sent_back"], tone: "back", bend: -34 },
  { id: "verify", from: "execution_completed", to: "pending_closure", label: "Verify", actor: "Job issuer", actions: ["verified"], when: "Verification checklist done", tone: "forward", bend: 40 },
  { id: "send-back-issuer", from: "pending_closure", to: "execution_completed", label: "Send back", actor: "HOD or org admin", actions: ["sent_back"], tone: "back", bend: 40 },
  { id: "close", from: "pending_closure", to: "closed", label: "Close", actor: "HOD or org admin", actions: ["closed"], when: "Closure checklist done", tone: "forward" },
  { id: "veto", from: "veto", to: "rejected", label: "Stop work", actor: "Safety officer", actions: ["safety_veto"], when: "Any live status", tone: "stop", dashed: true, labelT: 0.12 },
  { id: "expire", from: "active", to: "expired", label: "Window ends", actor: "System", actions: ["expired"], when: "Planned end passed without renewal", tone: "stop", dashed: true },
  { id: "cancel", from: "active", to: "cancelled", label: "Serious incident", actor: "System", actions: ["cancelled"], when: "Incident severity rules", tone: "stop", dashed: true, labelT: 0.75 },
];

export const NODE_BY_ID = new Map(NODES.map((node) => [node.id, node]));

/** The edge a recorded move travelled, or null when the map has no such move. */
export function edgeFor(from: string | null | undefined, to: string | null | undefined, action?: string): ProcessEdge | null {
  if (action === "safety_veto") return EDGES.find((e) => e.id === "veto") ?? null;
  if (to === "cancelled") return EDGES.find((e) => e.id === "cancel") ?? null;
  if (to === "expired") return EDGES.find((e) => e.id === "expire") ?? null;
  if (!from || !to) return null;
  return (
    EDGES.find((e) => e.from === from && e.to === to && (!action || e.actions.includes(action))) ??
    EDGES.find((e) => e.from === from && e.to === to) ??
    null
  );
}

export function stageTitle(status: string): string {
  return NODE_BY_ID.get(status)?.title ?? status.replace(/_/g, " ");
}

export type JourneyEvent = {
  id: string;
  at: string;
  from: string | null;
  to: string | null;
  action: string;
  actorId: string | null;
  comment: string | null;
  edgeId: string | null;
  /** Not in the history log; worked out from the permit record. */
  inferred?: boolean;
  /** How long the permit sat in `from` before this move. */
  stayMs: number | null;
};

export type Journey = {
  events: JourneyEvent[];
  visited: Set<string>;
  edges: Map<string, number>;
  current: string;
  enteredCurrentAt: string;
  /** Things in the record that do not add up, for the debug panel. */
  anomalies: string[];
};

type HistoryLike = {
  id: string;
  action: string;
  actorId: string;
  comment: string | null;
  createdAt: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: Record<string, unknown> | null;
};

type PermitLike = {
  status: string;
  createdAt: string;
  createdBy?: string | null;
  submittedAt: string | null;
  submittedBy?: string | null;
  updatedAt: string;
};

const NOT_MOVES = new Set(["created", "sla_escalated", "workflow_blocked"]);

/** One permit's path through the map, rebuilt from its approval and status history. */
export function buildJourney(permit: PermitLike, history: HistoryLike[]): Journey {
  const anomalies: string[] = [];
  const raw: Omit<JourneyEvent, "edgeId" | "stayMs">[] = [
    { id: "created", at: [permit.createdAt, permit.submittedAt ?? permit.createdAt, ...history.map((h) => h.createdAt)].sort()[0], from: null, to: "draft", action: "created", actorId: permit.createdBy ?? null, comment: null },
    ...history.map((h) => ({
      id: h.id,
      at: h.createdAt,
      from: h.fromStatus ?? null,
      to: h.toStatus ?? null,
      action: h.action,
      // Moves made by scheduled jobs are logged against the issuer; show them as the system's.
      actorId: h.metadata?.system ? null : h.actorId,
      comment: h.comment,
    })),
  ];
  // Permits submitted before first submissions were logged: rebuild the move from the permit record.
  if (permit.submittedAt && !history.some((h) => h.action === "submitted" || h.action === "resubmitted")) {
    raw.push({ id: "submitted", at: permit.submittedAt, from: "draft", to: "pending_approval", action: "submitted", actorId: permit.submittedBy ?? null, comment: null, inferred: true });
  }
  raw.sort((a, b) => a.at.localeCompare(b.at));

  const visited = new Set<string>(["draft"]);
  const edges = new Map<string, number>();
  const events: JourneyEvent[] = [];
  let stage = "draft";
  let enteredAt = raw[0]?.at ?? permit.createdAt;

  for (const event of raw) {
    // Events that are not moves (creation, SLA escalations) stay on the timeline without moving the permit.
    const moves = Boolean(event.to) && !NOT_MOVES.has(event.action);
    const from = event.from ?? (moves ? stage : null);
    const edge = moves ? edgeFor(from, event.to, event.action) : null;
    if (moves && from && from !== stage) {
      anomalies.push(`"${event.action}" at ${event.at} starts from ${from}, but the permit was at ${stage}.`);
    }
    if (moves && !edge) {
      anomalies.push(`"${event.action}" from ${from ?? "?"} to ${event.to} is not a move on the process map.`);
    }
    events.push({
      ...event,
      from,
      edgeId: edge?.id ?? null,
      stayMs: moves ? new Date(event.at).getTime() - new Date(enteredAt).getTime() : null,
    });
    if (edge) edges.set(edge.id, (edges.get(edge.id) ?? 0) + 1);
    if (edge?.id === "veto") visited.add("veto");
    if (moves && event.to) {
      visited.add(event.to);
      if (event.to !== stage) enteredAt = event.at;
      stage = event.to;
    }
  }

  if (stage !== permit.status) {
    const edge = edgeFor(stage, permit.status);
    anomalies.push(`Status is ${permit.status} but the last logged move ended at ${stage}. The change was not logged.`);
    events.push({
      id: "unlogged",
      at: permit.updatedAt,
      from: stage,
      to: permit.status,
      action: permit.status === "expired" ? "expired" : "unlogged",
      actorId: null,
      comment: null,
      edgeId: edge?.id ?? null,
      inferred: true,
      stayMs: new Date(permit.updatedAt).getTime() - new Date(enteredAt).getTime(),
    });
    if (edge) edges.set(edge.id, (edges.get(edge.id) ?? 0) + 1);
    visited.add(permit.status);
    enteredAt = permit.updatedAt;
  }

  return { events, visited, edges, current: permit.status, enteredCurrentAt: enteredAt, anomalies };
}

/** "3 d 4 h", "5 h 10 min", "12 min". */
export function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return "";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}
