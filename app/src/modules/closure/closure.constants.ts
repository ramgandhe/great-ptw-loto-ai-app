export const ACTIVE_STATUS = 'active' as const;
export const CLOSED_STATUS = 'closed' as const;

/** Operational roles only — platform-admin excluded from verify/close (FR-ROL-003). */
export const CLOSURE_VERIFY_ROLES = ['supervisor', 'org-admin'] as const;

export const CLOSURE_CLOSE_ROLES = ['supervisor', 'org-admin'] as const;

/** Distinct HOD final-closure audit action (FR-ROL-001). */
export const HOD_FINAL_CLOSURE_ACTION = 'hod_final_closure' as const;

export const CLOSURE_ARCHIVE_READ_ROLES = [
  'job-issuer',
  'supervisor',
  'org-admin',
  'platform-admin',
  'viewer',
] as const;

export const CLOSURE_HISTORY_READ_ROLES = [...CLOSURE_ARCHIVE_READ_ROLES] as const;

export const CLOSURE_NOTIFICATION_JOB = 'closure.notification';
export const CLOSURE_ARCHIVE_JOB = 'closure.archive';
export const CLOSURE_REPORT_JOB = 'closure.report';
