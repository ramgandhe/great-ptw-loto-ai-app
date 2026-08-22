export const INCIDENT_CLOSURE_NOTIFY_JOB = 'incident.closure-notify';

export const INCIDENT_VERIFY_ROLES = [
  'safety-officer',
  'org-admin',
  'platform-admin',
] as const;

export const INCIDENT_CLOSE_ROLES = [
  'safety-officer',
  'hod',
  'org-admin',
  'platform-admin',
] as const;

export const INCIDENT_ARCHIVE_READ_ROLES = [
  ...INCIDENT_CLOSE_ROLES,
  'viewer',
] as const;
