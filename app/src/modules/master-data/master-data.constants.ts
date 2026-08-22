export const MASTER_DATA_IMPORT_JOB = 'master-data.import';

export const MASTER_DATA_WRITE_ROLES = ['org-admin', 'platform-admin'] as const;

export const MASTER_DATA_READ_ROLES = [
  ...MASTER_DATA_WRITE_ROLES,
  'hod',
  'operator',
  'job-issuer',
  'viewer',
] as const;

export const PPE_CATEGORIES = [
  'head',
  'eye',
  'hearing',
  'respiratory',
  'hand',
  'foot',
  'body',
  'fall-protection',
  'other',
] as const;

export const HAZARD_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export const MASTER_DATA_CACHE_TYPES = [
  'permit-types',
  'ppe',
  'machinery',
  'workstations',
  'hazards',
  'checklists',
] as const;
