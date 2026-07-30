export const EXECUTION_IN_PROGRESS = 'in_progress' as const;
export const EXECUTION_ISOLATED = 'isolated' as const;
export const EXECUTION_VERIFIED = 'verified' as const;
export const EXECUTION_RESTORED = 'restored' as const;

export const PLAN_READY = 'ready' as const;
export const PLAN_IN_EXECUTION = 'in_execution' as const;

export const LOCK_APPLIED = 'applied' as const;
export const LOCK_REMOVED = 'removed' as const;

export const VERIFICATION_PASS = 'pass' as const;
export const VERIFICATION_FAIL = 'fail' as const;

// RBAC roles. Derived from SP-03.01 lototo_assignments roles
// (isolation_officer, verifier, supervisor) plus tenancy admins.
export const ISOLATION_ACTION_ROLES = [
  'isolation-officer',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const ISOLATION_VERIFY_ROLES = [
  'verifier',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const ISOLATION_READ_ROLES = [
  'isolation-officer',
  'verifier',
  'supervisor',
  'org-admin',
  'platform-admin',
  'job-issuer',
  'viewer',
] as const;
