export const ORGANISATION_WRITE_ROLES = ['org-admin', 'platform-admin'] as const;

export const ORGANISATION_READ_ROLES = [
  ...ORGANISATION_WRITE_ROLES,
  'supervisor',
  'operator',
  'viewer',
] as const;
