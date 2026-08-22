export const ACTIVE_STATUS = 'active' as const;
export const CLOSED_STATUS = 'closed' as const;

/** HOD only — administrators must not verify closure (FR-ROL-003). */
export const CLOSURE_VERIFY_ROLES = ['hod'] as const;

export const CLOSURE_CLOSE_ROLES = ['hod'] as const;

export const CLOSURE_ARCHIVE_READ_ROLES = [
  'job-issuer',
  'hod',
  'org-admin',
  'platform-admin',
  'viewer',
] as const;

export const CLOSURE_HISTORY_READ_ROLES = [...CLOSURE_ARCHIVE_READ_ROLES] as const;

export const CLOSURE_NOTIFICATION_JOB = 'closure.notification';
export const CLOSURE_ARCHIVE_JOB = 'closure.archive';
export const CLOSURE_REPORT_JOB = 'closure.report';
