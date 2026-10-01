import type { PendingApprovalItem } from "@/lib/approval/types";
import type { PermitRecord } from "@/lib/permit/types";

/**
 * What the signed-in person should act on, with the same groups and verbs as the web app's
 * Needs you (frontend/src/lib/work-queue.ts); each item opens this app's screen for the job.
 */
export type WorkAction =
  | "review"
  | "safety-check"
  | "final-approval"
  | "approve-completion"
  | "revalidate"
  | "start-work"
  | "log-progress"
  | "site-details"
  | "revise"
  | "finish-draft";

export const WORK_ACTIONS: Record<WorkAction, { group: string; verb: string }> = {
  review: { group: "Waiting for your approval", verb: "Review" },
  "safety-check": { group: "Safety check before work starts", verb: "Check" },
  "final-approval": { group: "Waiting for final sign-off", verb: "Sign off" },
  "approve-completion": { group: "Work finished, confirm completion", verb: "Confirm" },
  revalidate: { group: "Suspended, needs revalidation", verb: "Revalidate" },
  "start-work": { group: "Approved, ready to start", verb: "Start work" },
  "log-progress": { group: "In progress", verb: "Update" },
  "site-details": { group: "Add your on-site details", verb: "Add details" },
  revise: { group: "Sent back to you", verb: "Revise" },
  "finish-draft": { group: "Drafts to finish", verb: "Continue" },
};

export type WorkItem = { key: string; action: WorkAction; permit: PermitRecord; href: string; urgent: boolean };

const has = (roles: string[], allowed: string[]) => roles.some((role) => allowed.includes(role));
const CREATE = ["job-issuer", "tenant-owner", "tenant-admin"];
const EXECUTOR = ["operator"];
const REVALIDATE = ["job-issuer", "hod", "tenant-owner", "tenant-admin"];
const COMPLETION = ["job-issuer", "tenant-owner", "tenant-admin"];
const FINAL = ["hod", "tenant-owner", "tenant-admin"];

export function buildWorkQueue(roles: string[], permits: PermitRecord[], approvals: PendingApprovalItem[]): WorkItem[] {
  const items: WorkItem[] = [];
  const add = (action: WorkAction, permit: PermitRecord, href: string, urgent = false) =>
    items.push({ key: `${action}:${permit.id}`, action, permit, href, urgent });

  const reviewing = new Set(approvals.map((item) => item.permit.id));
  for (const item of approvals) add("review", item.permit, `/approvals/${item.permit.id}`);

  const isSafetyOfficer = roles.includes("safety-officer");
  for (const permit of permits) {
    if (reviewing.has(permit.id)) continue;
    if (isSafetyOfficer && (permit.status === "pending_approval" || permit.status === "approved")) {
      add("safety-check", permit, `/permits/${permit.id}`);
      continue;
    }
    switch (permit.status) {
      case "draft":
        if (has(roles, CREATE)) add("finish-draft", permit, `/permits/${permit.id}/edit`);
        else if (has(roles, EXECUTOR)) add("site-details", permit, `/permits/${permit.id}/edit`);
        break;
      case "deferred":
      case "rejected":
        if (has(roles, CREATE)) add("revise", permit, `/permits/${permit.id}/edit`, true);
        break;
      case "approved":
        if (has(roles, EXECUTOR)) add("start-work", permit, `/execution/${permit.id}`);
        break;
      case "active":
        if (has(roles, EXECUTOR)) add("log-progress", permit, `/execution/${permit.id}`);
        break;
      case "suspended":
        if (has(roles, REVALIDATE)) add("revalidate", permit, `/execution/${permit.id}`, true);
        break;
      case "execution_completed":
        if (has(roles, COMPLETION)) add("approve-completion", permit, `/closure/${permit.id}`);
        break;
      case "pending_closure":
        if (has(roles, FINAL)) add("final-approval", permit, `/closure/${permit.id}`);
        break;
    }
  }
  const order = Object.keys(WORK_ACTIONS);
  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || order.indexOf(a.action) - order.indexOf(b.action));
}
