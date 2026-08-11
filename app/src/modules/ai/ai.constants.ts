/** Operational roles permitted to query the AI assistant (BUG-10). */
export const AI_QUERY_ROLES = [
  'operator',
  'job-issuer',
  'supervisor',
  'safety-officer',
  'safety-manager',
  'org-admin',
  'platform-admin',
  'viewer',
] as const;
