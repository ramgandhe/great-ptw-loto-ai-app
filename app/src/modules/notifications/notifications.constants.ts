/** Explicit FR-NOT ↔ eventType mapping (FR-NTF infra is not proof of FR-NOT). */
export const FR_NOT_EVENT_TRACEABILITY = {
  'FR-NOT-002': 'permit_approved',
  'FR-NOT-003': 'permit_rejected',
  'FR-NOT-004': 'permit_deferred',
  'FR-NOT-005': 'permit_expiry',
  'FR-NOT-006': 'incident_reported',
  'FR-NOT-007': 'simops_conflict',
  'FR-NOT-008': 'lototo_verification',
} as const;

export type FrNotRequirementId = keyof typeof FR_NOT_EVENT_TRACEABILITY;

/** BullMQ job: retry failed notification deliveries using recipient retry metadata. */
export const NOTIFICATION_DELIVERY_RETRY_JOB = 'notification.delivery-retry';

/** BullMQ job: emit scheduled task-reminder sweeps (FR-NTF-002). */
export const NOTIFICATION_TASK_REMINDER_JOB = 'notification.task-reminder';

/** BullMQ job: FR-NOT-005 permit expiry notices. */
export const NOTIFICATION_PERMIT_EXPIRY_JOB = 'notification.permit-expiry';

export const NOTIFICATION_SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000097';

export const NOTIFICATION_READ_ROLES = [
  'operator',
  'job-issuer',
  'supervisor',
  'safety-officer',
  'safety-manager',
  'org-admin',
  'platform-admin',
  'viewer',
] as const;

export const NOTIFICATION_TEST_ROLES = ['org-admin', 'platform-admin'] as const;
