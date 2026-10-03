/**
 * Safety statuses (LOTOTO, isolation, incidents, SIMOPS) in the permit colour families, as on the
 * web (frontend/src/lib/safety/status.ts): each maps to the permit status whose colour it shares.
 */
type Tone = { label: string; key: string };
const st = (label: string, key: string): Tone => ({ label, key });

export const LOTOTO_PLAN_STATUS: Record<string, Tone> = {
  draft: st("Draft", "draft"),
  ready: st("Ready", "approved"),
  in_execution: st("In execution", "active"),
  completed: st("Completed", "closed"),
};

export const ISOLATION_STATUS: Record<string, Tone> = {
  in_progress: st("Isolating", "pending_approval"),
  isolated: st("Isolated, to verify", "execution_completed"),
  verified: st("Verified safe", "active"),
  restored: st("Restored", "closed"),
};

export const INCIDENT_STATUS: Record<string, Tone> = {
  draft: st("Draft", "draft"),
  open: st("Open", "deferred"),
  pending_hod_decision: st("Pending HOD decision", "pending_approval"),
  investigating: st("Investigating", "active"),
  pending_verification: st("Pending verification", "execution_completed"),
  verified: st("Verified", "pending_closure"),
  closed: st("Closed", "closed"),
};

export const CONFLICT_STATUS: Record<string, Tone> = {
  open: st("Open", "deferred"),
  assessed: st("Assessed", "pending_approval"),
  mitigation_planned: st("Mitigation planned", "approved"),
  approved: st("Approved", "closed"),
  rejected: st("Rejected", "cancelled"),
};

export type SafetyStatusMap = Record<string, Tone>;

export function toneOf(map: SafetyStatusMap, status: string): Tone {
  return map[status] ?? { label: status.replace(/_/g, " "), key: "" };
}

export const INCIDENT_TYPE_LABELS: Record<string, string> = { incident: "Incident", near_miss: "Near miss", unsafe_condition: "Unsafe condition" };
