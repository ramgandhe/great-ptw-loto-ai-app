export const MDP_REVALIDATION_REMINDER_JOB = 'mdp.revalidation-reminder';
export const MDP_EXTENSION_EXPIRY_JOB = 'mdp.extension-expiry';
export const MDP_DAY_TRANSITION_VALIDITY_JOB = 'mdp.day-transition-validity';
export const MDP_VALIDITY_NOTIFICATION_JOB = 'mdp.validity-notification';

export const REVALIDATION_WRITE_ROLES = [
  'permit-approver',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const REVALIDATION_READ_ROLES = [
  ...REVALIDATION_WRITE_ROLES,
  'permit-operator',
  'permit-receiver',
  'viewer',
] as const;

/** Executor + area/issuer may complete end-of-day secure (Slice B). */
export const DAY_SECURE_WRITE_ROLES = [
  'permit-operator',
  'permit-receiver',
  'permit-approver',
  'tenant-owner',
  'tenant-admin',
  'platform-admin',
] as const;

/** Area/issuer countersign on secure when required. */
export const DAY_SECURE_COUNTERSIGN_ROLES = [
  'permit-receiver',
  'permit-approver',
  'tenant-owner',
  'tenant-admin',
  'platform-admin',
] as const;

/** Day-scoped emergency override (Slice D). */
export const MDP_OVERRIDE_ROLES = [
  'permit-approver',
  'tenant-owner',
  'tenant-admin',
  'platform-admin',
] as const;

export const EXTENSION_REQUEST_ROLES = [
  'permit-receiver',
  'permit-approver',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

export const EXTENSION_APPROVE_ROLES = [
  'permit-approver',
  'tenant-owner', 'tenant-admin',
  'platform-admin',
] as const;

/** Same-day overtime request (Slice H). */
export const OVERTIME_REQUEST_ROLES = [
  'permit-operator',
  'permit-receiver',
  'permit-approver',
  'tenant-owner',
  'tenant-admin',
  'platform-admin',
] as const;

/**
 * Default overtime approvers. Tenant may route to area-authority / shift-in-charge
 * via organisations.overtimeApproverRole (enforced in Slice H).
 */
export const OVERTIME_APPROVE_ROLES = [
  'permit-approver',
  'tenant-owner',
  'tenant-admin',
  'platform-admin',
] as const;

/** Incoming party may accept/reject a pending handover (Slice E). */
export const HANDOVER_ACCEPT_ROLES = [
  'permit-operator',
  'permit-receiver',
  'permit-approver',
  'tenant-owner',
  'tenant-admin',
  'platform-admin',
] as const;
