/** BullMQ job: retry failed notification deliveries using recipient retry metadata. */
export const NOTIFICATION_DELIVERY_RETRY_JOB = 'notification.delivery-retry';

/** BullMQ job: emit scheduled task-reminder sweeps (FR-NTF-002). */
export const NOTIFICATION_TASK_REMINDER_JOB = 'notification.task-reminder';

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
