export const APPROVAL_NOTIFICATION_JOB = 'approval.notification';
export const APPROVAL_REMINDER_JOB = 'approval.reminder';
export const APPROVAL_ESCALATION_JOB = 'approval.escalation';

/** Operational approvers only — platform-admin is excluded (FR-ROL-003). */
export const APPROVER_ROLES = ['supervisor', 'org-admin'] as const;

export const APPROVAL_READ_ROLES = [...APPROVER_ROLES, 'viewer', 'platform-admin'] as const;

export const APPROVAL_ACTION_ROLES = [...APPROVER_ROLES] as const;

export const SAFETY_OFFICER_VETO_ROLES = ['safety-officer'] as const;

/**
 * HOD role mapping (FR-ROL-001).
 * Ambiguity: PRD uses "HOD"; Keycloak seed currently maps this to `org-admin`.
 * Product may later introduce a dedicated `hod` role — keep this list configurable.
 */
export const HOD_ROLES = ['org-admin'] as const;

export const HOD_INITIAL_REVIEW_ACTION = 'hod_initial_review' as const;
export const HOD_FINAL_CLOSURE_ACTION = 'hod_final_closure' as const;

export function userHasHodRole(roles: string[]): boolean {
  return HOD_ROLES.some((role) => roles.includes(role));
}

export const PENDING_APPROVAL_STATUS = 'pending_approval' as const;
