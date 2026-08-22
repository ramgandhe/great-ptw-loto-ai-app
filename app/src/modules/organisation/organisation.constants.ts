export const ORGANISATION_WRITE_ROLES = ['org-admin', 'platform-admin'] as const;

export const ORGANISATION_READ_ROLES = [
  ...ORGANISATION_WRITE_ROLES,
  'hod',
  'operator',
  'job-issuer',
  'safety-officer',
  'viewer',
] as const;
