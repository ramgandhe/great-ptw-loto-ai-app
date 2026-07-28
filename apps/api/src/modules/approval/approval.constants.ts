export const APPROVAL_NOTIFICATION_JOB = 'approval.notification';

export const APPROVER_ROLES = ['supervisor', 'org-admin', 'platform-admin'] as const;

export const APPROVAL_READ_ROLES = [...APPROVER_ROLES, 'viewer'] as const;

export const APPROVAL_ACTION_ROLES = [...APPROVER_ROLES] as const;

export const PENDING_APPROVAL_STATUS = 'pending_approval' as const;
