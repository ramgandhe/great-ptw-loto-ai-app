export const INCIDENT_OPEN_REMINDER_JOB = 'incident.open-reminder';

export const INCIDENT_EVIDENCE_PREFIX = 'incidents/evidence';

export const INCIDENT_REPORT_ROLES = [
  'permit-operator',
  'permit-receiver',
  'permit-approver',
  'safety-officer',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const INCIDENT_READ_ROLES = [
  ...INCIDENT_REPORT_ROLES,
  'viewer',
] as const;

export const INCIDENT_SAFETY_ROLES = [
  'safety-officer',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const INCIDENT_HOD_DECISION_ROLES = ['permit-approver', 'tenant-owner', 'tenant-admin'] as const;

export const ALLOWED_INCIDENT_EVIDENCE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_INCIDENT_EVIDENCE_SIZE_BYTES = 15 * 1024 * 1024;
