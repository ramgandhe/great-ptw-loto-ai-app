export const RESTORATION_ACTION_ROLES = [
  'permit-operator',
  'permit-approver',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const RESTORATION_VERIFY_ROLES = [
  'safety-officer',
  'permit-approver',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const RESTORATION_READ_ROLES = [
  'permit-operator',
  'safety-officer',
  'permit-approver',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
  'permit-receiver',
  'viewer',
] as const;

export const RESTORATION_NOTIFICATION_JOB = 'restoration.notification';

export const RESTORATION_PASS = 'pass' as const;
export const RESTORATION_FAIL = 'fail' as const;
export const RESTORATION_STATUS_RESTORED = 'restored' as const;
export const LOCK_REMOVED = 'removed' as const;
