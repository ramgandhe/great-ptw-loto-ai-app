export const SIMOPS_CONFLICT_DETECTION_JOB = 'simops.conflict-detection';
export const SIMOPS_NOTIFICATION_JOB = 'simops.notification';
export const SIMOPS_ESCALATION_JOB = 'simops.escalation';

/** Permit statuses included in continuous SIMOPS conflict sweeps. */
export const SIMOPS_ACTIVE_PERMIT_STATUSES = [
  'pending_approval',
  'approved',
  'active',
  'suspended',
] as const;

export const SIMOPS_READ_ROLES = [
  'job-issuer',
  'supervisor',
  'org-admin',
  'platform-admin',
  'viewer',
] as const;

export const SIMOPS_ACTION_ROLES = [
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

/** Assess / mitigate / approve / reject (FR-SIM-018 Safety Officer / HOD). */
export const SIMOPS_RESOLVE_ROLES = [
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

/** Default high-severity unresolved timeout before site-level escalation (FR-SIM-019). */
export const SIMOPS_DEFAULT_ESCALATION_TIMEOUT_HOURS = 4;
