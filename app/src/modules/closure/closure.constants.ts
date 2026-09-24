export const ACTIVE_STATUS = 'active' as const;
export const CLOSED_STATUS = 'closed' as const;

export const EXECUTION_COMPLETED_STATUS = 'execution_completed' as const;
export const PENDING_CLOSURE_STATUS = 'pending_closure' as const;

export const CLOSURE_VERIFY_ROLES = [
  'job-issuer',
  'hod',
  'tenant-owner',
  'tenant-admin',
] as const;

export const CLOSURE_CLOSE_ROLES = ['hod', 'tenant-owner', 'tenant-admin'] as const;

export const CLOSURE_ARCHIVE_READ_ROLES = [
  'job-issuer',
  'hod',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
  'viewer',
] as const;

export const CLOSURE_HISTORY_READ_ROLES = [...CLOSURE_ARCHIVE_READ_ROLES] as const;

export const CLOSURE_NOTIFICATION_JOB = 'closure.notification';
export const CLOSURE_ARCHIVE_JOB = 'closure.archive';
export const CLOSURE_REPORT_JOB = 'closure.report';
