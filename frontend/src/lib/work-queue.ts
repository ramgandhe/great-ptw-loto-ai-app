import type { PendingApprovalItem } from "@/lib/approval/types";
import type { Incident } from "@/lib/incidents/types";
import type { SimopsConflict } from "@/lib/simops/types";
import type { PermitRecord } from "@/lib/permit/types";
import { hasAnyRole } from "@/lib/auth/rbac";
import { NAV_OPERATOR_DRAFTS_ROLES, PERMIT_CREATE_ROLES } from "@/lib/auth/roles";

export type WorkAction =
  | "review"
  | "finish-draft"
  | "site-details"
  | "revise"
  | "start-work"
  | "log-progress"
  | "revalidate"
  | "approve-completion"
  | "final-approval"
  | "resolve-conflict"
  | "incident-decision"
  | "assign-investigation"
  | "investigate"
  | "verify-incident"
  | "close-incident"
  | "safety-check";

export type WorkItem = {
  key: string;
  action: WorkAction;
  label: string;
  href: string;
  /** Set for permit work; SIMOPS and incident items carry their own title instead. */
  permit?: PermitRecord;
  title: string;
  reference?: string | null;
  /** Extra context shown under the title for non-permit items, e.g. severity. */
  meta?: string;
  /** Why it needs attention now, e.g. "Overdue by 2 days" or the approval stage. */
  note?: string;
  urgent: boolean;
};

/** Action group heading and the button label used for each item in it. */
/**
 * What kind of move an action is. Buttons are coloured by kind, so the same kind of job looks
 * the same everywhere: decide (approve, sign off, confirm), fix (something came back or clashes),
 * do (carry the work forward), admin (route or close records).
 */
export type ActionKind = "decide" | "fix" | "do" | "admin";

export const WORK_ACTIONS: Record<WorkAction, { group: string; verb: string; kind: ActionKind }> = {
  "incident-decision": { group: "Incidents waiting for your decision", verb: "Decide", kind: "decide" },
  "resolve-conflict": { group: "Clashing work to resolve (SIMOPS)", verb: "Resolve", kind: "fix" },
  review: { group: "Waiting for your approval", verb: "Review", kind: "decide" },
  "safety-check": { group: "Safety check before work starts", verb: "Check", kind: "decide" },
  "final-approval": { group: "Waiting for final sign-off", verb: "Sign off", kind: "decide" },
  "approve-completion": { group: "Work finished, confirm completion", verb: "Confirm", kind: "decide" },
  revalidate: { group: "Suspended, needs revalidation", verb: "Revalidate", kind: "fix" },
  "start-work": { group: "Approved, ready to start", verb: "Start work", kind: "do" },
  "log-progress": { group: "In progress", verb: "Update", kind: "do" },
  "site-details": { group: "Add your on-site details", verb: "Add details", kind: "do" },
  revise: { group: "Sent back to you", verb: "Revise", kind: "fix" },
  "finish-draft": { group: "Drafts to finish", verb: "Continue", kind: "do" },
  "assign-investigation": { group: "Incidents needing an investigator", verb: "Assign", kind: "admin" },
  investigate: { group: "Investigations in progress", verb: "Continue", kind: "do" },
  "verify-incident": { group: "Investigations to verify", verb: "Verify", kind: "decide" },
  "close-incident": { group: "Incidents ready to close", verb: "Close", kind: "admin" },
};

const ACTION_ORDER = Object.keys(WORK_ACTIONS) as WorkAction[];

const REVALIDATE_ROLES = ["job-issuer", "hod", "tenant-owner", "tenant-admin"];
const EXECUTOR_ROLES = ["operator"];
const COMPLETION_ROLES = ["job-issuer", "tenant-owner", "tenant-admin"];
const FINAL_APPROVAL_ROLES = ["hod", "tenant-owner", "tenant-admin"];
const SIMOPS_RESOLVE_ROLES = ["hod", "tenant-owner", "tenant-admin"];
const INCIDENT_HOD_ROLES = ["hod", "tenant-owner", "tenant-admin"];
const INCIDENT_SAFETY_ROLES = ["safety-officer", "tenant-owner", "tenant-admin"];
const INVESTIGATION_ROLES = ["safety-officer", "hod", "tenant-owner", "tenant-admin"];
const SAFETY_OFFICER_ROLES = ["safety-officer"];
const OPEN_CONFLICT_STATUSES = ["open", "assessed", "mitigation_planned"];

function overdueNote(permit: PermitRecord, now: number): string | undefined {
  if (!permit.plannedEndAt) return undefined;
  const late = now - new Date(permit.plannedEndAt).getTime();
  if (late <= 0) return undefined;
  const days = Math.floor(late / 86_400_000);
  return days >= 1 ? `Past planned end by ${days} day${days === 1 ? "" : "s"}` : "Past planned end";
}

function startsSoonNote(permit: PermitRecord, now: number): string | undefined {
  if (!permit.plannedStartAt) return undefined;
  const until = new Date(permit.plannedStartAt).getTime() - now;
  if (until < 0) return "Planned start has passed";
  if (until < 86_400_000) return `Starts in ${Math.max(1, Math.round(until / 3_600_000))} h`;
  return undefined;
}

/**
 * Everything the signed-in person should act on, derived from the permits they can see
 * and their approval assignments. Each item links straight to the screen that does the job.
 */
export function buildWorkQueue(
  roles: string[],
  permits: PermitRecord[],
  approvals: PendingApprovalItem[],
  conflicts: SimopsConflict[] = [],
  incidents: Incident[] = [],
  now = Date.now(),
): WorkItem[] {
  const items: WorkItem[] = [];
  const add = (action: WorkAction, permit: PermitRecord, href: string, note?: string, urgent = false) =>
    items.push({
      key: `${action}:${permit.id}`,
      action,
      label: WORK_ACTIONS[action].verb,
      href,
      permit,
      title: permit.title,
      reference: permit.reference,
      note,
      urgent,
    });

  const reviewing = new Set<string>();
  for (const item of approvals) {
    reviewing.add(item.permit.id);
    add("review", item.permit, `/approvals/${item.permit.id}`, item.step?.name ? `Stage: ${item.step.name}` : undefined);
  }

  const canCreate = hasAnyRole(roles, PERMIT_CREATE_ROLES);
  const isExecutor = hasAnyRole(roles, NAV_OPERATOR_DRAFTS_ROLES) || hasAnyRole(roles, EXECUTOR_ROLES);

  // The API only returns permits a safety officer is assigned to.
  const isSafetyOfficer = hasAnyRole(roles, SAFETY_OFFICER_ROLES);

  for (const permit of permits) {
    if (reviewing.has(permit.id)) continue;
    if (isSafetyOfficer && (permit.status === "pending_approval" || permit.status === "approved")) {
      add("safety-check", permit, `/permits/${permit.id}`, startsSoonNote(permit, now), Boolean(startsSoonNote(permit, now)));
      continue;
    }
    switch (permit.status) {
      case "draft":
        if (canCreate) add("finish-draft", permit, `/permits/${permit.id}/edit`);
        else if (isExecutor) add("site-details", permit, `/permits/${permit.id}/edit`);
        break;
      case "deferred":
      case "rejected":
        // The row's status badge already says deferred or rejected.
        if (canCreate) add("revise", permit, `/permits/${permit.id}/edit`, undefined, true);
        break;
      case "approved":
        if (isExecutor) {
          const note = startsSoonNote(permit, now);
          add("start-work", permit, `/execution/${permit.id}`, note, Boolean(note));
        }
        break;
      case "active":
        if (isExecutor) {
          const note = overdueNote(permit, now);
          add("log-progress", permit, `/execution/${permit.id}`, note, Boolean(note));
        }
        break;
      case "suspended":
        if (hasAnyRole(roles, REVALIDATE_ROLES)) add("revalidate", permit, `/execution/${permit.id}`, undefined, true);
        break;
      case "execution_completed":
        if (hasAnyRole(roles, COMPLETION_ROLES)) add("approve-completion", permit, `/closure/${permit.id}`);
        break;
      case "pending_closure":
        if (hasAnyRole(roles, FINAL_APPROVAL_ROLES)) add("final-approval", permit, `/closure/${permit.id}`);
        break;
    }
  }

  if (hasAnyRole(roles, SIMOPS_RESOLVE_ROLES)) {
    for (const conflict of conflicts.filter((c) => OPEN_CONFLICT_STATUSES.includes(c.status))) {
      items.push({
        key: `resolve-conflict:${conflict.id}`,
        action: "resolve-conflict",
        label: WORK_ACTIONS["resolve-conflict"].verb,
        href: `/simops/conflicts/${conflict.id}`,
        title: conflict.summary,
        meta: `${conflict.severity.charAt(0).toUpperCase()}${conflict.severity.slice(1)} severity, ${conflict.conflictType.replace(/_/g, " ")} clash`,
        note: conflict.status === "open" ? "Not assessed yet" : undefined,
        urgent: conflict.severity === "high",
      });
    }
  }

  const incidentAction = (incident: Incident): WorkAction | null => {
    switch (incident.status) {
      case "pending_hod_decision":
        return hasAnyRole(roles, INCIDENT_HOD_ROLES) ? "incident-decision" : null;
      case "open":
        return hasAnyRole(roles, INCIDENT_SAFETY_ROLES) ? "assign-investigation" : null;
      case "investigating":
        return hasAnyRole(roles, INVESTIGATION_ROLES) ? "investigate" : null;
      case "pending_verification":
        return hasAnyRole(roles, INCIDENT_SAFETY_ROLES) ? "verify-incident" : null;
      case "verified":
        return hasAnyRole(roles, INCIDENT_SAFETY_ROLES) ? "close-incident" : null;
      default:
        return null;
    }
  };
  for (const incident of incidents) {
    const action = incidentAction(incident);
    if (!action) continue;
    items.push({
      key: `${action}:${incident.id}`,
      action,
      label: WORK_ACTIONS[action].verb,
      href: `/incidents/${incident.id}`,
      title: incident.title,
      reference: incident.reference,
      meta: `${incident.incidentType.replace(/_/g, " ")}, ${incident.priority} priority`,
      urgent: incident.priority === "critical" || incident.priority === "high",
    });
  }

  return items.sort(
    (a, b) =>
      Number(b.urgent) - Number(a.urgent) ||
      ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action) ||
      (a.permit?.plannedStartAt ?? "").localeCompare(b.permit?.plannedStartAt ?? ""),
  );
}

/** Nav badge counts keyed by nav href. */
export function workCountsByRoute(items: WorkItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const bump = (href: string) => (counts[href] = (counts[href] ?? 0) + 1);
  for (const item of items) {
    if (item.action === "resolve-conflict") bump("/simops");
    else if (!item.permit) bump("/incidents");
    // Every permit step (review, drafts, work, closure) is worked from the Permits list.
    else bump("/permits");
  }
  return counts;
}
