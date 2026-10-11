export const LOTOTO_WRITE_ROLES = [
  'permit-approver',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const LOTOTO_READ_ROLES = [...LOTOTO_WRITE_ROLES, 'permit-operator', 'viewer'] as const;

export const LOTOTO_ENERGY_TYPES = [
  'electrical',
  'mechanical',
  'hydraulic',
  'pneumatic',
  'chemical',
  'thermal',
  'pressure',
  'gravity',
  'gravitational',
  'stored_energy',
  'radiation',
  'other',
] as const;

export const LOTOTO_LIBRARY_WRITE_ROLES = [
  'permit-approver',
  'tenant-owner',
  'tenant-admin',
  'platform-admin',
] as const;

export const LOTOTO_LIBRARY_READ_ROLES = [
  ...LOTOTO_LIBRARY_WRITE_ROLES,
  'permit-approver',
  'permit-operator',
  'permit-receiver',
  'safety-officer',
  'viewer',
] as const;

export const LOTOTO_EDITABLE_STATUSES = ['draft', 'ready'] as const;

export const LOTOTO_NOTIFICATION_JOB = 'lototo.notification';
export const LOTOTO_PLANNING_REMINDER_JOB = 'lototo.planning-reminder';
