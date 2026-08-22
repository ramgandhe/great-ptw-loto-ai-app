/**
 * PRD permit lifecycle — six phases overall. Only phases marked `approval` use the
 * approval workflow; executor phases are on-site data entry during creation/execution.
 */
export const PERMIT_LIFECYCLE_PHASES = [
  {
    sequence: 1,
    name: 'Issuer initiation',
    participantRole: 'job-issuer',
    kind: 'collaboration',
  },
  {
    sequence: 2,
    name: 'Executor on-site details',
    participantRole: 'operator',
    kind: 'collaboration',
  },
  {
    sequence: 3,
    name: 'HOD initial review',
    participantRole: 'hod',
    kind: 'approval',
  },
  {
    sequence: 4,
    name: 'Executor pre-work confirmation',
    participantRole: 'operator',
    kind: 'execution',
  },
  {
    sequence: 5,
    name: 'Issuer completion approval',
    participantRole: 'job-issuer',
    kind: 'closure',
  },
  {
    sequence: 6,
    name: 'HOD final approval',
    participantRole: 'hod',
    kind: 'closure',
  },
] as const;

/** Gates in the approval workflow table (submit-time review only). */
export const DEFAULT_APPROVAL_WORKFLOW_STEPS = [
  {
    stepSequence: 1,
    name: 'HOD initial review',
    approverRole: 'hod',
  },
] as const;
