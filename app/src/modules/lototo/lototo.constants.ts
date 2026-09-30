export const LOTOTO_WRITE_ROLES = [
  'hod',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const LOTOTO_READ_ROLES = [...LOTOTO_WRITE_ROLES, 'operator', 'viewer'] as const;

export const LOTOTO_LIBRARY_WRITE_ROLES = ['tenant-owner', 'tenant-admin', 'platform-admin'] as const;

export const LOTOTO_LIBRARY_READ_ROLES = [
  ...LOTOTO_LIBRARY_WRITE_ROLES,
  'hod',
  'operator',
  'job-issuer',
  'safety-officer',
  'viewer',
] as const;

export const LOTOTO_EDITABLE_STATUSES = ['draft', 'ready'] as const;

export const LOTOTO_NOTIFICATION_JOB = 'lototo.notification';
export const LOTOTO_PLANNING_REMINDER_JOB = 'lototo.planning-reminder';
