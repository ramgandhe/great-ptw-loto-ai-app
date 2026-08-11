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

export const APPROVAL_DECISIONS = ['approve', 'reject', 'defer'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const APPROVAL_HISTORY_ACTIONS = [
  'submitted',
  'approved',
  'rejected',
  'deferred',
  'stage_advanced',
  'resubmitted',
  'hod_initial_review',
  'supervisor_cosign',
  'workflow_restarted_core_edit',
  'escalated',
  'blocked',
] as const;
export type ApprovalHistoryAction = (typeof APPROVAL_HISTORY_ACTIONS)[number];

export const WORKFLOW_RESUBMIT_MODES = [
  'restart_from_stage_1',
  'resume_from_rejecting_stage',
] as const;
export type WorkflowResubmitMode = (typeof WORKFLOW_RESUBMIT_MODES)[number];

export const QUORUM_MODES = ['all', 'first'] as const;
export type QuorumMode = (typeof QUORUM_MODES)[number];

export const REJECTION_REASON_CODES = [
  'incomplete_hazard_information',
  'ppe_mismatch',
  'scheduling_conflict',
  'insufficient_controls',
  'other',
] as const;
export type RejectionReasonCode = (typeof REJECTION_REASON_CODES)[number];

export type WorkflowStepCondition = {
  requiresLototo?: boolean;
  requiresEnergyIsolation?: boolean;
  minRiskLevel?: 'low' | 'medium' | 'high';
  attributeEquals?: Record<string, string | boolean | number>;
};

/** FR-PTW-013 — admin-defined ordered approval templates. */
export const approvalWorkflowTemplates = pgTable(
  'approval_workflow_templates',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    permitTypeId: uuid('permit_type_id'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    /** FR-PTW-026 */
    resubmitMode: varchar('resubmit_mode', { length: 32 })
      .notNull()
      .default('restart_from_stage_1'),
  },
  (table) => [
    uniqueIndex('approval_workflow_templates_tenant_code_unique').on(table.tenantId, table.code),
    index('approval_workflow_templates_tenant_id_idx').on(table.tenantId),
    index('approval_workflow_templates_tenant_type_idx').on(table.tenantId, table.permitTypeId),
  ],
);

export const workflowSteps = pgTable(
  'workflow_steps',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitTypeId: uuid('permit_type_id'),
    templateId: uuid('template_id').references(() => approvalWorkflowTemplates.id, {
      onDelete: 'set null',
    }),
    stepSequence: integer('step_sequence').notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    /** FR-PTW-014 — role, not named individual. */
    approverRole: varchar('approver_role', { length: 64 }).notNull(),
    /** FR-PTW-014 — organizational scope hint (e.g. same_department). */
    orgScope: varchar('org_scope', { length: 64 }).notNull().default('same_department'),
    /** FR-PTW-016 — steps sharing a group activate in parallel. */
    parallelGroup: varchar('parallel_group', { length: 64 }),
    quorumMode: varchar('quorum_mode', { length: 32 }).notNull().default('all'),
    /** FR-PTW-015 — conditional include/skip. */
    condition: jsonb('condition').$type<WorkflowStepCondition>(),
    /** FR-PTW-018 — risk-based branching threshold. */
    minRiskLevel: varchar('min_risk_level', { length: 16 }),
    /** FR-PTW-019 */
    slaMinutes: integer('sla_minutes'),
    /** FR-PTW-020/022 — ordered fallback roles (max 3 levels enforced in jobs). */
    escalationFallbackRoles: jsonb('escalation_fallback_roles').$type<string[]>(),
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
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    slaDueAt: timestamp('sla_due_at', { withTimezone: true }),
    /** FR-PTW-025 — defer pauses SLA clock. */
    slaPausedAt: timestamp('sla_paused_at', { withTimezone: true }),
    escalationLevel: integer('escalation_level').notNull().default(0),
    parallelGroup: varchar('parallel_group', { length: 64 }),
  },
  (table) => [
    uniqueIndex('workflow_assignments_permit_step_unique').on(
      table.permitId,
      table.workflowStepId,
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
    /** FR-PTW-024 */
    reasonCode: varchar('reason_code', { length: 64 }),
    /** FR-PTW-023 — approved by X on behalf of Y. */
    onBehalfOf: uuid('on_behalf_of'),
    decidedBy: uuid('decided_by').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_approvals_permit_step_unique').on(table.permitId, table.workflowStepId),
    index('permit_approvals_permit_id_idx').on(table.permitId),
    index('permit_approvals_decided_by_idx').on(table.decidedBy),
  ],
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
