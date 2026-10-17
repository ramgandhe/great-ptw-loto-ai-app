/**
 * PRD permit lifecycle — six phases overall. Only phases marked `approval` use the
 * approval workflow; executor phases are on-site data entry during creation/execution.
 */
export const PERMIT_LIFECYCLE_PHASES = [
  {
    sequence: 1,
    name: 'Receiver initiation',
    participantRole: 'permit-receiver',
    kind: 'collaboration',
  },
  {
    sequence: 2,
    name: 'Executor on-site details',
    participantRole: 'permit-operator',
    kind: 'collaboration',
  },
  {
    sequence: 3,
    name: 'Approver initial review',
    participantRole: 'permit-approver',
    kind: 'approval',
  },
  {
    sequence: 4,
    name: 'Executor pre-work confirmation',
    participantRole: 'permit-operator',
    kind: 'execution',
  },
  {
    sequence: 5,
    name: 'Receiver completion approval',
    participantRole: 'permit-receiver',
    kind: 'closure',
  },
  {
    sequence: 6,
    name: 'Approver final approval',
    participantRole: 'permit-approver',
    kind: 'closure',
  },
] as const;

/** Gates in the approval workflow table (submit-time review only). */
export const DEFAULT_APPROVAL_WORKFLOW_STEPS = [
  {
    stepSequence: 1,
    name: 'Approver initial review',
    approverRole: 'permit-approver',
  },
] as const;

export const PLATFORM_DEFAULT_WORKFLOW_CODE = 'PLATFORM_DEFAULT';

export const PLATFORM_DEFAULT_WORKFLOW_NAME = 'Platform default';

export const APPROVAL_APPROVER_ROLES = ['permit-approver', 'permit-receiver', 'safety-officer'] as const;

export type ApprovalApproverRole = (typeof APPROVAL_APPROVER_ROLES)[number];

export function isApprovalApproverRole(role: string): role is ApprovalApproverRole {
  return (APPROVAL_APPROVER_ROLES as readonly string[]).includes(role);
}
