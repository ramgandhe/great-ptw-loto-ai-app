export const WORKFORCE_WRITE_ROLES = ['org-admin', 'platform-admin'] as const;

export const WORKFORCE_READ_ROLES = [
  ...WORKFORCE_WRITE_ROLES,
  'supervisor',
  'operator',
  'viewer',
] as const;
