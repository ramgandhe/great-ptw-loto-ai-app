export const INVESTIGATION_OVERDUE_JOB = 'investigation.overdue-actions';

export const INVESTIGATION_ASSIGN_ROLES = [
  'safety-officer',
  'org-admin',
  'platform-admin',
] as const;

export const INVESTIGATION_WRITE_ROLES = [
  ...INVESTIGATION_ASSIGN_ROLES,
  'hod',
] as const;

export const INVESTIGATION_READ_ROLES = [
  ...INVESTIGATION_WRITE_ROLES,
  'viewer',
] as const;

export const CORRECTIVE_ACTION_UPDATE_ROLES = [
  ...INVESTIGATION_WRITE_ROLES,
  'operator',
  'job-issuer',
] as const;
