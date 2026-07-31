export const SIMOPS_WRITE_ROLES = [
  'supervisor',
  'org-admin',
  'platform-admin',
  'job-issuer',
] as const;

export const SIMOPS_READ_ROLES = [...SIMOPS_WRITE_ROLES, 'viewer'] as const;

export const ANALYSABLE_PERMIT_STATUSES = [
  'pending_approval',
  'approved',
  'active',
  'suspended',
] as const;

export const SIMOPS_RESOLVE_ROLES = [
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const RESOLVED_CONFLICT_STATUSES = ['approved', 'rejected'] as const;

export const ALERT_RECIPIENT_ROLES = ['supervisor', 'org-admin'] as const;
