export const PERMIT_WRITE_ROLES = [
  'operator',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const PERMIT_READ_ROLES = [...PERMIT_WRITE_ROLES, 'viewer'] as const;

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;
