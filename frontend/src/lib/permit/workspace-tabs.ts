import { hasAnyRole } from "@/lib/auth/rbac";
import { APPROVAL_READ_ROLES, EXECUTION_READ_ROLES } from "@/lib/auth/roles";

/** Sections of the permit workspace at /permits/[id]?tab=…; Overview is the default. */
export const WORKSPACE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "preparation", label: "Preparation" },
  { key: "review", label: "Review" },
  { key: "work", label: "Work" },
  { key: "history", label: "History" },
] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]["key"];

/** Statuses whose Review tab is the issuer's verification and the HOD's closure, not approval. */
export const CLOSURE_REVIEW_STATUSES = ["execution_completed", "pending_closure", "closed"];
/** Statuses with work on site: starting, progress, evidence, daily operations. */
export const WORK_STATUSES = ["approved", "active", "suspended"];

/** The tabs this person can open for a permit in `status`; the others have nothing for them yet. */
export function workspaceTabs(status: string, roles: string[]): WorkspaceTab[] {
  const review = CLOSURE_REVIEW_STATUSES.includes(status) || (status !== "draft" && hasAnyRole(roles, APPROVAL_READ_ROLES));
  const work = WORK_STATUSES.includes(status) && hasAnyRole(roles, EXECUTION_READ_ROLES);
  return WORKSPACE_TABS.map((tab) => tab.key).filter((key) => (key === "review" ? review : key === "work" ? work : true));
}

/** Link to one section of a permit's workspace. */
export function workspaceHref(permitId: string, tab: WorkspaceTab = "overview"): string {
  return tab === "overview" ? `/permits/${permitId}` : `/permits/${permitId}?tab=${tab}`;
}
