/** Mirrors backend RBAC role sets in app module constants files. */

export const AUTHENTICATED_ROLES = [
  "platform-admin",
  "org-admin",
  "supervisor",
  "operator",
  "job-issuer",
  "viewer",
  "safety-officer",
  "safety-manager",
  "isolation-officer",
  "verifier",
] as const;

export const DASHBOARD_READ_ROLES = [
  "operator",
  "job-issuer",
  "supervisor",
  "safety-officer",
  "safety-manager",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const DASHBOARD_REPORT_ROLES = [
  "supervisor",
  "safety-officer",
  "safety-manager",
  "org-admin",
  "platform-admin",
] as const;

export const DASHBOARD_ANALYTICS_ROLES = [
  "supervisor",
  "safety-officer",
  "safety-manager",
  "org-admin",
  "platform-admin",
] as const;

export const ORGANISATION_READ_ROLES = [
  "org-admin",
  "platform-admin",
  "supervisor",
  "operator",
  "viewer",
] as const;

export const ORGANISATION_WRITE_ROLES = ["org-admin", "platform-admin"] as const;

export const MASTER_DATA_READ_ROLES = [
  "org-admin",
  "platform-admin",
  "supervisor",
  "operator",
  "job-issuer",
  "viewer",
] as const;

export const WORKFORCE_READ_ROLES = [
  "org-admin",
  "platform-admin",
  "supervisor",
  "operator",
  "viewer",
] as const;

export const WORKFORCE_WRITE_ROLES = ["org-admin", "platform-admin"] as const;

export const PERMIT_READ_ROLES = [
  "job-issuer",
  "operator",
  "supervisor",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const PERMIT_WRITE_ROLES = [
  "job-issuer",
  "operator",
  "supervisor",
  "org-admin",
  "platform-admin",
] as const;

export const APPROVAL_READ_ROLES = [
  "supervisor",
  "safety-officer",
  "job-issuer",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const EXECUTION_READ_ROLES = [
  "operator",
  "supervisor",
  "org-admin",
  "platform-admin",
  "job-issuer",
  "viewer",
] as const;

export const MDP_READ_ROLES = [
  "job-issuer",
  "operator",
  "supervisor",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const LOTOTO_READ_ROLES = [
  "supervisor",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const LOTOTO_WRITE_ROLES = ["supervisor", "org-admin", "platform-admin"] as const;

export const ISOLATION_READ_ROLES = [
  "isolation-officer",
  "verifier",
  "supervisor",
  "org-admin",
  "platform-admin",
  "job-issuer",
  "viewer",
] as const;

export const RESTORATION_READ_ROLES = [
  "isolation-officer",
  "verifier",
  "supervisor",
  "org-admin",
  "platform-admin",
  "job-issuer",
  "viewer",
] as const;

export const SIMOPS_READ_ROLES = [
  "supervisor",
  "org-admin",
  "platform-admin",
  "job-issuer",
  "viewer",
] as const;

export const INCIDENT_READ_ROLES = [
  "operator",
  "job-issuer",
  "supervisor",
  "safety-officer",
  "org-admin",
  "platform-admin",
  "viewer",
  "safety-manager",
] as const;

export const INCIDENT_REPORT_ROLES = [
  "operator",
  "job-issuer",
  "supervisor",
  "safety-officer",
  "org-admin",
  "platform-admin",
] as const;

export const NOTIFICATION_READ_ROLES = [
  "operator",
  "job-issuer",
  "supervisor",
  "safety-officer",
  "safety-manager",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const BILLING_READ_ROLES = ["org-admin", "platform-admin", "safety-manager"] as const;

export const CLOSURE_READ_ROLES = [
  "job-issuer",
  "supervisor",
  "org-admin",
  "platform-admin",
  "viewer",
] as const;

export const PLATFORM_OPS_ROLES = ["org-admin", "platform-admin"] as const;

export const AI_ASSISTANT_ROLES = NOTIFICATION_READ_ROLES;

export const SAFETY_HUB_ROLES = [
  "job-issuer",
  "operator",
  "supervisor",
  "org-admin",
  "platform-admin",
  "viewer",
  "safety-officer",
  "safety-manager",
] as const;
