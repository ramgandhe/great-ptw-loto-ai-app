export const SIMOPS_CONFLICT_DETECTION_JOB = 'simops.conflict-detection';
export const SIMOPS_NOTIFICATION_JOB = 'simops.notification';

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
