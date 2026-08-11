export const INCIDENT_OPEN_REMINDER_JOB = 'incident.open-reminder';

export const INCIDENT_EVIDENCE_PREFIX = 'incidents/evidence';

/** System actor for automated accident termination (FR-INC-011). */
export const INCIDENT_SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000098';

export const INCIDENT_REPORT_ROLES = [
  'operator',
  'job-issuer',
  'supervisor',
  'safety-officer',
  'org-admin',
  'platform-admin',
] as const;

export const INCIDENT_READ_ROLES = [
  ...INCIDENT_REPORT_ROLES,
  'viewer',
  'safety-manager',
] as const;

export const INCIDENT_SAFETY_ROLES = [
  'safety-officer',
  'safety-manager',
  'org-admin',
  'platform-admin',
] as const;

/** HOD continue/stop on near-miss path only (FR-INC-011). Executors excluded. */
export const INCIDENT_HOD_DECISION_ROLES = [
  'org-admin',
  'safety-manager',
  'safety-officer',
] as const;

export const ALLOWED_INCIDENT_EVIDENCE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_INCIDENT_EVIDENCE_SIZE_BYTES = 15 * 1024 * 1024;

/** Permit statuses cancelled by accident / near-miss stop. */
export const CANCELABLE_PERMIT_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'active',
  'suspended',
  'deferred',
] as const;
