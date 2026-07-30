export const EDITABLE_PERMIT_STATUSES = ['draft', 'deferred', 'rejected'] as const;

export const SUBMITTABLE_PERMIT_STATUSES = ['draft', 'deferred', 'rejected'] as const;

export function isEditablePermitStatus(status: string): boolean {
  return (EDITABLE_PERMIT_STATUSES as readonly string[]).includes(status);
}

export function isSubmittablePermitStatus(status: string): boolean {
  return (SUBMITTABLE_PERMIT_STATUSES as readonly string[]).includes(status);
}

export const PERMIT_WRITE_ROLES = [
  'job-issuer',
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
