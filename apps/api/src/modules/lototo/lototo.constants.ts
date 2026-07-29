export const LOTOTO_WRITE_ROLES = [
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const LOTOTO_READ_ROLES = [...LOTOTO_WRITE_ROLES, 'viewer'] as const;

export const LOTOTO_EDITABLE_STATUSES = ['draft', 'ready'] as const;
