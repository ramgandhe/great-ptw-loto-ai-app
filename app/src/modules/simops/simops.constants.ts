export const SIMOPS_WRITE_ROLES = [
  'hod',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
  'job-issuer',
] as const;

/** Safety officers review conflicts (PRD 4.6) but do not run analysis or resolve them. */
export const SIMOPS_READ_ROLES = [...SIMOPS_WRITE_ROLES, 'safety-officer', 'viewer'] as const;

export const ANALYSABLE_PERMIT_STATUSES = [
  'pending_approval',
  'approved',
  'active',
  'suspended',
] as const;

export const SIMOPS_RESOLVE_ROLES = [
  'hod',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const RESOLVED_CONFLICT_STATUSES = ['approved', 'rejected'] as const;

export const ALERT_RECIPIENT_ROLES = ['hod', 'tenant-owner', 'tenant-admin'] as const;
