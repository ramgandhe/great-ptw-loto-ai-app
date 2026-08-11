export const MDP_REVALIDATION_REMINDER_JOB = 'mdp.revalidation-reminder';
export const MDP_EXTENSION_EXPIRY_JOB = 'mdp.extension-expiry';
/** FR-MDP-009 — daily validity transition against approved date range. */
export const MDP_VALIDITY_TRANSITION_JOB = 'mdp.validity-transition';

/** Deterministic system actor for automated MDP jobs (not a login principal). */
export const MDP_SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000099';

export const REVALIDATION_WRITE_ROLES = [
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const REVALIDATION_READ_ROLES = [
  ...REVALIDATION_WRITE_ROLES,
  'job-issuer',
  'viewer',
] as const;

export const EXTENSION_REQUEST_ROLES = [
  'job-issuer',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const EXTENSION_APPROVE_ROLES = [
  'org-admin',
  'platform-admin',
] as const;

/** HOD renewal decision (FR-MDP-009). */
export const RENEWAL_APPROVE_ROLES = [
  'org-admin',
  'platform-admin',
  'safety-manager',
] as const;

export const RENEWAL_REQUEST_ROLES = EXTENSION_REQUEST_ROLES;
