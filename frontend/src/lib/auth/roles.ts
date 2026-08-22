/** Mirrors backend RBAC role sets — seven PRD personas plus platform-admin. */

export const AUTHENTICATED_ROLES = [
  "platform-admin",
  "org-admin",
  "hod",
  "operator",
  "job-issuer",
  "safety-officer",
  "viewer",
] as const;

export const DASHBOARD_READ_ROLES = [
  "operator",
  "job-issuer",
  "hod",
  "safety-officer",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const DASHBOARD_REPORT_ROLES = [
  "hod",
  "safety-officer",
  "org-admin",
  "platform-admin",
] as const;

export const DASHBOARD_ANALYTICS_ROLES = [
  "hod",
  "safety-officer",
  "org-admin",
  "platform-admin",
] as const;

export const ORGANISATION_READ_ROLES = [
  "org-admin",
  "platform-admin",
  "hod",
  "operator",
  "job-issuer",
  "safety-officer",
  "viewer",
] as const;

export const ORGANISATION_WRITE_ROLES = ["org-admin", "platform-admin"] as const;

export const MASTER_DATA_READ_ROLES = [
  "org-admin",
  "platform-admin",
  "hod",
  "operator",
  "job-issuer",
  "viewer",
] as const;

export const WORKFORCE_READ_ROLES = [
  "org-admin",
  "platform-admin",
  "hod",
  "operator",
  "job-issuer",
  "safety-officer",
  "viewer",
] as const;

export const WORKFORCE_WRITE_ROLES = ["org-admin", "platform-admin"] as const;

export const PERMIT_READ_ROLES = [
  "job-issuer",
  "operator",
  "hod",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const PERMIT_CREATE_ROLES = ["job-issuer", "org-admin", "platform-admin"] as const;

export const PERMIT_SUBMIT_ROLES = PERMIT_CREATE_ROLES;

export const PERMIT_WRITE_ROLES = [
  ...PERMIT_CREATE_ROLES,
  "operator",
  "hod",
] as const;

export const APPROVAL_READ_ROLES = [
  "job-issuer",
  "operator",
  "hod",
  "safety-officer",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const EXECUTION_READ_ROLES = [
  "operator",
  "hod",
  "org-admin",
  "platform-admin",
  "job-issuer",
  "viewer",
] as const;

export const MDP_READ_ROLES = [
  "job-issuer",
  "operator",
  "hod",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const LOTOTO_READ_ROLES = [
  "hod",
  "operator",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const LOTOTO_WRITE_ROLES = ["hod", "org-admin", "platform-admin"] as const;

export const ISOLATION_READ_ROLES = [
  "operator",
  "safety-officer",
  "hod",
  "org-admin",
  "platform-admin",
  "job-issuer",
  "viewer",
] as const;

export const RESTORATION_READ_ROLES = [
  "operator",
  "safety-officer",
  "hod",
  "org-admin",
  "platform-admin",
  "job-issuer",
  "viewer",
] as const;

export const SIMOPS_READ_ROLES = [
  "hod",
  "org-admin",
  "platform-admin",
  "job-issuer",
  "viewer",
] as const;

export const INCIDENT_READ_ROLES = [
  "operator",
  "job-issuer",
  "hod",
  "safety-officer",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const INCIDENT_REPORT_ROLES = [
  "operator",
  "job-issuer",
  "hod",
  "safety-officer",
  "org-admin",
  "platform-admin",
] as const;

export const NOTIFICATION_READ_ROLES = [
  "operator",
  "job-issuer",
  "hod",
  "safety-officer",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const BILLING_READ_ROLES = ["org-admin", "platform-admin", "safety-officer", "hod"] as const;

export const CLOSURE_READ_ROLES = [
  "job-issuer",
  "hod",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const SAFETY_HUB_ROLES = [
  "job-issuer",
  "operator",
  "hod",
  "org-admin",
  "platform-admin",
  "viewer",
  "safety-officer",
] as const;

/** Sidebar visibility — PRD persona scoped. Admins see config only (FR-ROL-003). */
export const NAV_ORGANISATION_ROLES = ["org-admin", "platform-admin"] as const;
export const NAV_WORKFORCE_ROLES = ["org-admin", "platform-admin"] as const;
export const NAV_PERMITS_ROLES = ["job-issuer", "operator", "hod", "viewer"] as const;
export const NAV_DRAFTS_ROLES = ["job-issuer"] as const;
export const NAV_ACTIVE_WORK_ROLES = ["job-issuer", "operator", "hod", "viewer"] as const;
export const NAV_APPROVALS_ROLES = ["hod", "safety-officer", "job-issuer", "viewer"] as const;
export const NAV_DEFERRED_ROLES = ["hod", "safety-officer", "job-issuer"] as const;
export const NAV_OPERATOR_DRAFTS_ROLES = ["operator"] as const;
export const NAV_EXECUTION_ROLES = ["operator", "hod", "job-issuer", "viewer"] as const;
export const NAV_LOTOTO_ROLES = ["hod", "operator", "viewer"] as const;
export const NAV_SIMOPS_ROLES = ["hod", "safety-officer", "job-issuer", "viewer"] as const;
export const NAV_INCIDENTS_ROLES = [
  "operator",
  "job-issuer",
  "hod",
  "safety-officer",
  "viewer",
] as const;
export const NAV_CLOSURE_ROLES = ["job-issuer", "hod", "viewer"] as const;
export const NAV_SAFETY_ROLES = [
  "safety-officer",
  "hod",
  "job-issuer",
  "operator",
  "viewer",
] as const;
