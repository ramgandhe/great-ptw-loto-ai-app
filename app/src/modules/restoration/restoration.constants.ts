export const RESTORATION_ACTION_ROLES = [
  'isolation-officer',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const RESTORATION_VERIFY_ROLES = [
  'verifier',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const RESTORATION_READ_ROLES = [
  'isolation-officer',
  'verifier',
  'supervisor',
  'org-admin',
  'platform-admin',
  'job-issuer',
  'viewer',
] as const;

export const RESTORATION_NOTIFICATION_JOB = 'restoration.notification';

export const RESTORATION_PASS = 'pass' as const;
export const RESTORATION_FAIL = 'fail' as const;
export const RESTORATION_STATUS_RESTORED = 'restored' as const;
export const LOCK_REMOVED = 'removed' as const;
