export const EXECUTION_ACTION_ROLES = [
  'operator',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const EXECUTION_READ_ROLES = [
  ...EXECUTION_ACTION_ROLES,
  'job-issuer',
  'viewer',
] as const;

export const EXECUTION_NOTIFICATION_JOB = 'execution.notification';
