export const MDP_REVALIDATION_REMINDER_JOB = 'mdp.revalidation-reminder';
export const MDP_EXTENSION_EXPIRY_JOB = 'mdp.extension-expiry';
export const MDP_DAY_TRANSITION_VALIDITY_JOB = 'mdp.day-transition-validity';
export const MDP_VALIDITY_NOTIFICATION_JOB = 'mdp.validity-notification';

export const REVALIDATION_WRITE_ROLES = [
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const REVALIDATION_READ_ROLES = [
  ...REVALIDATION_WRITE_ROLES,
  'job-issuer',
  'viewer',
] as const;

export const EXTENSION_REQUEST_ROLES = [
  'job-issuer',
  'supervisor',
  'org-admin',
  'platform-admin',
] as const;

export const EXTENSION_APPROVE_ROLES = [
  'org-admin',
  'platform-admin',
] as const;
