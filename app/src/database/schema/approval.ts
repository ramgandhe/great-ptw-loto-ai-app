import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { permits } from './permit';

export const ASSIGNMENT_STATUSES = ['pending', 'active', 'completed', 'skipped'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const STAGE_MODES = ['sequential', 'parallel'] as const;
export type StageMode = (typeof STAGE_MODES)[number];

export const QUORUM_MODES = ['all', 'first'] as const;
export type QuorumMode = (typeof QUORUM_MODES)[number];

export const APPROVAL_DECISIONS = ['approve', 'reject', 'defer'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const REJECTION_REASON_CODES = [
  'incomplete_hazard_info',
  'ppe_mismatch',
  'scheduling_conflict',
  'insufficient_controls',
  'documentation_missing',
  'other',
] as const;
export type RejectionReasonCode = (typeof REJECTION_REASON_CODES)[number];

export const APPROVAL_HISTORY_ACTIONS = [
  'submitted',
  'approved',
  'rejected',
  'deferred',
  'stage_advanced',
  'resubmitted',
  'safety_veto',
  'sla_escalated',
  'workflow_blocked',
] as const;
export type ApprovalHistoryAction = (typeof APPROVAL_HISTORY_ACTIONS)[number];

export const workflowSteps = pgTable(
  'workflow_steps',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitTypeId: uuid('permit_type_id'),
    stepSequence: integer('step_sequence').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    approverRole: varchar('approver_role', { length: 64 }).notNull(),
    stageMode: varchar('stage_mode', { length: 32 }).notNull().default('sequential'),
    quorumMode: varchar('quorum_mode', { length: 32 }).notNull().default('all'),
    parallelRoles: jsonb('parallel_roles').$type<string[]>(),
    slaHours: integer('sla_hours'),
    stepConfig: jsonb('step_config').$type<Record<string, unknown>>().notNull().default({}),
    commentRequiredOnApprove: boolean('comment_required_on_approve').notNull().default(false),
    commentRequiredOnReject: boolean('comment_required_on_reject').notNull().default(true),
    commentRequiredOnDefer: boolean('comment_required_on_defer').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('workflow_steps_tenant_id_idx').on(table.tenantId),
    index('workflow_steps_tenant_permit_type_idx').on(table.tenantId, table.permitTypeId),
    uniqueIndex('workflow_steps_tenant_default_sequence_unique')
      .on(table.tenantId, table.stepSequence)
      .where(sql`"permit_type_id" IS NULL`),
    uniqueIndex('workflow_steps_tenant_type_sequence_unique')
      .on(table.tenantId, table.permitTypeId, table.stepSequence)
      .where(sql`"permit_type_id" IS NOT NULL`),
  ],
);

export const workflowAssignments = pgTable(
  'workflow_assignments',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    workflowStepId: uuid('workflow_step_id')
      .notNull()
      .references(() => workflowSteps.id, { onDelete: 'restrict' }),
    assigneeId: uuid('assignee_id').notNull(),
    assignmentSlot: varchar('assignment_slot', { length: 64 }).notNull().default('default'),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    slaDeadlineAt: timestamp('sla_deadline_at', { withTimezone: true }),
    escalationLevel: integer('escalation_level').notNull().default(0),
    slaPausedAt: timestamp('sla_paused_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('workflow_assignments_permit_step_slot_unique').on(
      table.permitId,
      table.workflowStepId,
      table.assignmentSlot,
    ),
    index('workflow_assignments_permit_id_idx').on(table.permitId),
    index('workflow_assignments_assignee_status_idx').on(table.assigneeId, table.status),
    index('workflow_assignments_workflow_step_id_idx').on(table.workflowStepId),
  ],
);

export const permitApprovals = pgTable(
  'permit_approvals',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    workflowStepId: uuid('workflow_step_id')
      .notNull()
      .references(() => workflowSteps.id, { onDelete: 'restrict' }),
    workflowAssignmentId: uuid('workflow_assignment_id').references(() => workflowAssignments.id, {
      onDelete: 'set null',
    }),
    decision: varchar('decision', { length: 32 }).notNull(),
    comment: text('comment'),
    reasonCode: varchar('reason_code', { length: 64 }),
    decidedBy: uuid('decided_by').notNull(),
    decidedOnBehalfOf: uuid('decided_on_behalf_of'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_approvals_assignment_unique')
      .on(table.workflowAssignmentId)
      .where(sql`"workflow_assignment_id" IS NOT NULL`),
    index('permit_approvals_permit_id_idx').on(table.permitId),
    index('permit_approvals_decided_by_idx').on(table.decidedBy),
  ],
);

export const approvalDelegations = pgTable(
  'approval_delegations',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    delegatorId: uuid('delegator_id').notNull(),
    delegateId: uuid('delegate_id').notNull(),
    role: varchar('role', { length: 64 }).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('approval_delegations_tenant_delegate_idx').on(table.tenantId, table.delegateId),
    index('approval_delegations_tenant_delegator_idx').on(table.tenantId, table.delegatorId),
  ],
);

export const approvalSlaEscalations = pgTable(
  'approval_sla_escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id').notNull(),
    workflowAssignmentId: uuid('workflow_assignment_id').notNull(),
    escalationLevel: integer('escalation_level').notNull(),
    fallbackRole: varchar('fallback_role', { length: 64 }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('approval_sla_escalations_permit_idx').on(table.permitId)],
);

export const approvalHistory = pgTable(
  'approval_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    permitApprovalId: uuid('permit_approval_id').references(() => permitApprovals.id, {
      onDelete: 'set null',
    }),
    workflowStepId: uuid('workflow_step_id').references(() => workflowSteps.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 64 }).notNull(),
    fromStatus: varchar('from_status', { length: 32 }),
    toStatus: varchar('to_status', { length: 32 }),
    actorId: uuid('actor_id').notNull(),
    comment: text('comment'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('approval_history_permit_id_idx').on(table.permitId),
    index('approval_history_permit_created_at_idx').on(table.permitId, table.createdAt),
    index('approval_history_actor_id_idx').on(table.actorId),
  ],
);
