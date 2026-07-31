export const MDP_REVALIDATION_REMINDER_JOB = 'mdp.revalidation-reminder';
export const MDP_EXTENSION_EXPIRY_JOB = 'mdp.extension-expiry';

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
