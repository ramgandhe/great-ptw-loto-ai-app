export const SIMOPS_WRITE_ROLES = [
  'supervisor',
  'org-admin',
  'platform-admin',
  'job-issuer',
] as const;

export const SIMOPS_READ_ROLES = [...SIMOPS_WRITE_ROLES, 'viewer'] as const;

export const ANALYSABLE_PERMIT_STATUSES = [
  'pending_approval',
  'approved',
  'active',
  'suspended',
] as const;

/** FR-SIM-015 / FR-SIM-018 — Safety Officer / HOD mapped to existing roles. */
export const SIMOPS_RESOLVE_ROLES = ['supervisor', 'org-admin'] as const;

export const SIMOPS_LOW_ACK_ROLES = ['job-issuer', 'supervisor', 'org-admin'] as const;

export const RESOLVED_CONFLICT_STATUSES = ['approved', 'rejected'] as const;

export const ALERT_RECIPIENT_ROLES = ['supervisor', 'org-admin', 'job-issuer'] as const;

export const FROZEN_PEER_STATUSES = ['approved', 'active'] as const;

export const DEFAULT_HIGH_ESCALATION_HOURS = 4;

export const SIMOPS_NIGHTLY_REEVAL_JOB = 'simops.nightly-reevaluation';
export const SIMOPS_ESCALATION_JOB = 'simops.cross-dept-escalation';
export const SIMOPS_NOTIFICATION_JOB = 'simops.notification';

/** Deterministic system actor for scheduled SIMOPS jobs (UUID). */
export const SIMOPS_SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000001';

export const ACTIVE_LOTOTO_PLAN_STATUSES = ['ready', 'in_execution', 'completed'] as const;
