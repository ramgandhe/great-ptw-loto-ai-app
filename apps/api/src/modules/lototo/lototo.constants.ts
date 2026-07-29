export const LOTOTO_WRITE_ROLES = [
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const LOTOTO_READ_ROLES = [...LOTOTO_WRITE_ROLES, 'viewer'] as const;

export const LOTOTO_EDITABLE_STATUSES = ['draft', 'ready'] as const;

export const LOTOTO_NOTIFICATION_JOB = 'lototo.notification';
export const LOTOTO_PLANNING_REMINDER_JOB = 'lototo.planning-reminder';
