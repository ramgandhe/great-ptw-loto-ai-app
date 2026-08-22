export const APPROVAL_NOTIFICATION_JOB = 'approval.notification';
export const APPROVAL_REMINDER_JOB = 'approval.reminder';
export const APPROVAL_SLA_ESCALATION_JOB = 'approval.sla-escalation';

/** Operational approvers only — administrators must not approve permits (FR-ROL-003). */
export const APPROVER_ROLES = ['hod', 'job-issuer'] as const;

export const SAFETY_VETO_ROLES = ['safety-officer'] as const;

export const SAFETY_VETO_ELIGIBLE_STATUSES = [
  'pending_approval',
  'approved',
  'active',
  'suspended',
  'deferred',
  'pending_closure',
] as const;

export const MAX_SLA_ESCALATION_LEVELS = 3;

export const APPROVAL_READ_ROLES = [
  ...APPROVER_ROLES,
  'job-issuer',
  'org-admin',
  'platform-admin',
  'viewer',
] as const;

export const APPROVAL_ACTION_ROLES = [...APPROVER_ROLES] as const;

export const PENDING_APPROVAL_STATUS = 'pending_approval' as const;
