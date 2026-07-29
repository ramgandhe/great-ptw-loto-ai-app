export const ACTIVE_STATUS = 'active' as const;
export const CLOSED_STATUS = 'closed' as const;

export const CLOSURE_VERIFY_ROLES = ['supervisor', 'org-admin', 'platform-admin'] as const;

export const CLOSURE_CLOSE_ROLES = ['supervisor', 'org-admin', 'platform-admin'] as const;

export const CLOSURE_ARCHIVE_READ_ROLES = [
  'job-issuer',
  'supervisor',
  'org-admin',
  'platform-admin',
  'viewer',
] as const;

export const CLOSURE_HISTORY_READ_ROLES = [...CLOSURE_ARCHIVE_READ_ROLES] as const;
