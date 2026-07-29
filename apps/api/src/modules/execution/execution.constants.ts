export const EXECUTION_NOTIFICATION_JOB = 'execution.notification';
export const EXECUTION_REMINDER_JOB = 'execution.reminder';

export const APPROVED_STATUS = 'approved' as const;
export const ACTIVE_STATUS = 'active' as const;
export const SUSPENDED_STATUS = 'suspended' as const;

export const EXECUTION_ACTION_ROLES = [
  'operator',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const EXECUTION_UPDATE_ROLES = [...EXECUTION_ACTION_ROLES] as const;

/** @deprecated Use EXECUTION_ACTION_ROLES or EXECUTION_UPDATE_ROLES */
export const EXECUTION_WRITE_ROLES = EXECUTION_UPDATE_ROLES;

export const EXECUTION_READ_ROLES = [...EXECUTION_UPDATE_ROLES, 'job-issuer', 'viewer'] as const;

export const MAX_EVIDENCE_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_EVIDENCE_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;
