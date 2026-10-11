export const ORGANISATION_WRITE_ROLES = ['tenant-owner', 'tenant-admin', 'platform-admin'] as const;

export const ORGANISATION_READ_ROLES = [
  ...ORGANISATION_WRITE_ROLES,
  'permit-approver',
  'permit-operator',
  'permit-receiver',
  'safety-officer',
  'viewer',
] as const;
