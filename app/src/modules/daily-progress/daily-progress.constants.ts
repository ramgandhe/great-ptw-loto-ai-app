export const MDP_DAILY_REMINDER_JOB = 'mdp.daily-reminder';

export const DAILY_PROGRESS_EVIDENCE_PREFIX = 'mdp/daily-progress';

export const MDP_WRITE_ROLES = [
  'job-issuer',
  'operator',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const MDP_READ_ROLES = [...MDP_WRITE_ROLES, 'viewer'] as const;

export const MDP_HANDOVER_ROLES = [
  'supervisor',
  'job-issuer',
  'org-admin',
  'platform-admin',
] as const;
