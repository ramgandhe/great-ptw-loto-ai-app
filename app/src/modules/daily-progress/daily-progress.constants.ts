export const MDP_DAILY_REMINDER_JOB = 'mdp.daily-reminder';

export const DAILY_PROGRESS_EVIDENCE_PREFIX = 'mdp/daily-progress';

export const MDP_WRITE_ROLES = [
  'job-issuer',
  'operator',
  'hod',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const MDP_READ_ROLES = [...MDP_WRITE_ROLES, 'viewer'] as const;

export const MDP_HANDOVER_ROLES = [
  'hod',
  'job-issuer',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;
