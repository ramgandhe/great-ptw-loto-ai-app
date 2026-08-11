import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  approvalHistory,
  approvalWorkflowTemplates,
  permitApprovals,
  permits,
  permitTypes,
  workflowAssignments,
  workflowSteps,
  type AssignmentStatus,
  type WorkflowResubmitMode,
} from '../../database/schema';
import {
  parallelStageOutcome,
  shouldIncludeStep,
  type PermitWorkflowContext,
  type RiskLevel,
} from './workflow-rules';

type DbClient = Pick<Database, 'insert' | 'update' | 'select' | 'delete'>;

export type InitializeAtSubmitOptions = {
  isResubmit?: boolean;
  fromStatus?: string;
};

@Injectable()
export class WorkflowEngineService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  private client(db?: DbClient): DbClient {
    return db ?? this.db;
  }

  async buildPermitContext(
    tenantId: string,
    permitId: string,
    permitTypeId: string,
    db?: DbClient,
  ): Promise<PermitWorkflowContext> {
    const client = this.client(db);
    const [permit] = await client
      .select({
        riskLevel: permits.riskLevel,
        machineryId: permits.machineryId,
      })
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)))
      .limit(1);

    const [permitType] = await client
      .select({
        riskClassification: permitTypes.riskClassification,
        defaultAttributes: permitTypes.defaultAttributes,
      })
      .from(permitTypes)
      .where(and(eq(permitTypes.id, permitTypeId), eq(permitTypes.tenantId, tenantId)))
      .limit(1);

    const riskLevel =
      (permit?.riskLevel as RiskLevel | null) ??
      (permitType?.riskClassification as RiskLevel | null) ??
      'medium';

    const attrs = (permitType?.defaultAttributes ?? {}) as Record<
      string,
      string | boolean | number
    >;
    const requiresLototo = Boolean(attrs.requiresLototo ?? attrs.requiresEnergyIsolation);
    const requiresEnergyIsolation = Boolean(
      attrs.requiresEnergyIsolation ?? attrs.requiresLototo ?? permit?.machineryId,
    );

    return {
      riskLevel,
      requiresLototo,
      requiresEnergyIsolation,
      attributes: attrs,
    };
  }

  async resolveSteps(
    tenantId: string,
    permitTypeId: string,
    context?: PermitWorkflowContext,
  ) {
    const typeSpecific = await this.db
      .select()
      .from(workflowSteps)
      .where(
        and(
          eq(workflowSteps.tenantId, tenantId),
          eq(workflowSteps.permitTypeId, permitTypeId),
          eq(workflowSteps.isActive, true),
        ),
      )
      .orderBy(asc(workflowSteps.stepSequence));

    const base =
      typeSpecific.length > 0
        ? typeSpecific
        : await this.db
            .select()
            .from(workflowSteps)
            .where(
              and(
                eq(workflowSteps.tenantId, tenantId),
                isNull(workflowSteps.permitTypeId),
                eq(workflowSteps.isActive, true),
              ),
            )
            .orderBy(asc(workflowSteps.stepSequence));

    if (!context) {
      return base;
    }

    return base.filter((step) => shouldIncludeStep(step, context));
  }

  async resolveResubmitMode(
    tenantId: string,
    permitTypeId: string,
    db?: DbClient,
  ): Promise<WorkflowResubmitMode> {
    const client = this.client(db);

    const [typed] = await client
      .select()
      .from(approvalWorkflowTemplates)
      .where(
        and(
          eq(approvalWorkflowTemplates.tenantId, tenantId),
          eq(approvalWorkflowTemplates.permitTypeId, permitTypeId),
          eq(approvalWorkflowTemplates.isActive, true),
        ),
      )
      .limit(1);

    if (typed?.resubmitMode) {
      return typed.resubmitMode as WorkflowResubmitMode;
    }

    const [fallback] = await client
      .select()
      .from(approvalWorkflowTemplates)
      .where(
        and(
          eq(approvalWorkflowTemplates.tenantId, tenantId),
          isNull(approvalWorkflowTemplates.permitTypeId),
          eq(approvalWorkflowTemplates.isActive, true),
          eq(approvalWorkflowTemplates.isDefault, true),
        ),
      )
      .limit(1);

    return (fallback?.resubmitMode as WorkflowResubmitMode | undefined) ?? 'restart_from_stage_1';
  }

  /**
   * FR-PTW-027 — core-field edit after the last reject forces Stage-1 restart
   * even when the template is configured for resume.
   */
  private async coreEditForcesRestart(permitId: string, db?: DbClient): Promise<boolean> {
    const client = this.client(db);

    const [lastReject] = await client
      .select()
      .from(approvalHistory)
      .where(and(eq(approvalHistory.permitId, permitId), eq(approvalHistory.action, 'rejected')))
      .orderBy(desc(approvalHistory.createdAt))
      .limit(1);

    if (!lastReject) {
      return false;
    }

    const [coreEdit] = await client
      .select()
      .from(approvalHistory)
      .where(
        and(
          eq(approvalHistory.permitId, permitId),
          eq(approvalHistory.action, 'workflow_restarted_core_edit'),
        ),
      )
      .orderBy(desc(approvalHistory.createdAt))
      .limit(1);

    return Boolean(coreEdit && coreEdit.createdAt >= lastReject.createdAt);
  }

  private async findLastRejectingStep(permitId: string, db?: DbClient) {
    const client = this.client(db);

    const [reject] = await client
      .select({
        history: approvalHistory,
        step: workflowSteps,
      })
      .from(approvalHistory)
      .innerJoin(workflowSteps, eq(approvalHistory.workflowStepId, workflowSteps.id))
      .where(and(eq(approvalHistory.permitId, permitId), eq(approvalHistory.action, 'rejected')))
      .orderBy(desc(approvalHistory.createdAt))
      .limit(1);

    return reject?.step ?? null;
  }

  async initializeAtSubmit(
    permitId: string,
    tenantId: string,
    permitTypeId: string,
    submittedBy: string,
    db?: DbClient,
    options?: InitializeAtSubmitOptions,
  ) {
    const client = this.client(db);

    let resumeFromSequence: number | null = null;
    let resumeWaveMinSequence: number | null = null;
    let resumeParallelGroupHint: string | null = null;
    let preservedApprovals: Array<typeof permitApprovals.$inferSelect> = [];
    let resubmitMode: WorkflowResubmitMode = 'restart_from_stage_1';

    // FR-PTW-026 — after rejection, optionally resume from the rejecting stage.
    if (options?.isResubmit && options.fromStatus === 'rejected') {
      resubmitMode = await this.resolveResubmitMode(tenantId, permitTypeId, db);
      if (await this.coreEditForcesRestart(permitId, db)) {
        resubmitMode = 'restart_from_stage_1';
      }

      if (resubmitMode === 'resume_from_rejecting_stage') {
        const rejectingStep = await this.findLastRejectingStep(permitId, db);
        if (rejectingStep) {
          resumeFromSequence = rejectingStep.stepSequence;
          resumeParallelGroupHint = rejectingStep.parallelGroup ?? null;
          resumeWaveMinSequence = rejectingStep.stepSequence;

          if (rejectingStep.parallelGroup) {
            const peers = await client
              .select({ stepSequence: workflowSteps.stepSequence })
              .from(workflowSteps)
              .where(
                and(
                  eq(workflowSteps.tenantId, tenantId),
                  eq(workflowSteps.parallelGroup, rejectingStep.parallelGroup),
                  eq(workflowSteps.isActive, true),
                ),
              );
            if (peers.length > 0) {
              resumeWaveMinSequence = Math.min(...peers.map((peer) => peer.stepSequence));
            }
          }

          preservedApprovals = await client
            .select({ approval: permitApprovals })
            .from(permitApprovals)
            .innerJoin(workflowSteps, eq(permitApprovals.workflowStepId, workflowSteps.id))
            .where(
              and(
                eq(permitApprovals.permitId, permitId),
                eq(permitApprovals.decision, 'approve'),
                lt(workflowSteps.stepSequence, resumeWaveMinSequence),
              ),
            )
            .then((rows) => rows.map((row) => row.approval));
        }
      }
    }

    await this.resetWorkflow(permitId, db);

    const context = await this.buildPermitContext(tenantId, permitId, permitTypeId, db);
    const steps = await this.resolveSteps(tenantId, permitTypeId, context);
    if (steps.length === 0) {
      throw new BadRequestException('No approval workflow configured for this permit type');
    }

    // Persist derived risk on the permit for auditability (FR-PTW-017).
    await client
      .update(permits)
      .set({ riskLevel: context.riskLevel, updatedBy: submittedBy })
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));

    const firstStep = steps[0];
    const firstParallelGroup = firstStep.parallelGroup;
    const resumeStep =
      resumeFromSequence != null
        ? steps.find((step) => step.stepSequence === resumeFromSequence) ?? firstStep
        : firstStep;
    const resumeParallelGroup = resumeParallelGroupHint ?? resumeStep.parallelGroup;
    const waveMin = resumeWaveMinSequence ?? resumeFromSequence;

    const assignments = await client
      .insert(workflowAssignments)
      .values(
        steps.map((step) => {
          const beforeResume = waveMin != null && step.stepSequence < waveMin;
          const inResumeWave = resumeParallelGroup
            ? step.parallelGroup === resumeParallelGroup
            : step.stepSequence === resumeStep.stepSequence;
          const inFirstWave = firstParallelGroup
            ? step.parallelGroup === firstParallelGroup
            : step.stepSequence === firstStep.stepSequence;

          let status: AssignmentStatus = 'pending';
          if (beforeResume) {
            status = 'completed';
          } else if (resumeFromSequence != null ? inResumeWave : inFirstWave) {
            status = 'active';
          }

          const slaDueAt =
            step.slaMinutes != null && (status === 'active' || status === 'pending')
              ? new Date(Date.now() + step.slaMinutes * 60_000)
              : null;

          return {
            permitId,
            workflowStepId: step.id,
            assigneeId: submittedBy,
            status,
            completedAt: status === 'completed' ? new Date() : null,
            parallelGroup: step.parallelGroup ?? null,
            slaDueAt,
            createdBy: submittedBy,
            updatedBy: submittedBy,
          };
        }),
      )
      .returning();

    // Re-attach preserved upstream approvals so prior stages stay decided.
    if (preservedApprovals.length > 0) {
      const byStep = new Map(assignments.map((row) => [row.workflowStepId, row]));
      await client.insert(permitApprovals).values(
        preservedApprovals.map((approval) => ({
          permitId,
          workflowStepId: approval.workflowStepId,
          workflowAssignmentId: byStep.get(approval.workflowStepId)?.id ?? null,
          decision: approval.decision,
          comment: approval.comment,
          reasonCode: approval.reasonCode,
          onBehalfOf: approval.onBehalfOf,
          decidedBy: approval.decidedBy,
          decidedAt: approval.decidedAt,
          createdBy: submittedBy,
          updatedBy: submittedBy,
        })),
      );
    }

    return { assignments, resubmitMode, resumeFromSequence };
  }

  async resetWorkflow(permitId: string, db?: DbClient) {
    const client = this.client(db);
    await client.delete(permitApprovals).where(eq(permitApprovals.permitId, permitId));
    await client.delete(workflowAssignments).where(eq(workflowAssignments.permitId, permitId));
  }

  /** @deprecated Use initializeAtSubmit during permit submission instead. */
  async ensureAssignmentsInitialized(
    permitId: string,
    tenantId: string,
    permitTypeId: string,
    actorId: string,
  ) {
    const existing = await this.db
      .select()
      .from(workflowAssignments)
      .where(eq(workflowAssignments.permitId, permitId));

    if (existing.length > 0) {
      return existing;
    }

    const result = await this.initializeAtSubmit(permitId, tenantId, permitTypeId, actorId);
    return result.assignments;
  }

  async getActiveAssignment(permitId: string) {
    const [assignment] = await this.db
      .select()
      .from(workflowAssignments)
      .where(
        and(eq(workflowAssignments.permitId, permitId), eq(workflowAssignments.status, 'active')),
      );

    return assignment ?? null;
  }

  async getActiveAssignments(permitId: string) {
    return this.db
      .select({
        assignment: workflowAssignments,
        step: workflowSteps,
      })
      .from(workflowAssignments)
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .where(
        and(eq(workflowAssignments.permitId, permitId), eq(workflowAssignments.status, 'active')),
      )
      .orderBy(asc(workflowSteps.stepSequence));
  }

  async getAssignmentWithStep(permitId: string, assignmentId: string) {
    const [assignment] = await this.db
      .select({
        assignment: workflowAssignments,
        step: workflowSteps,
      })
      .from(workflowAssignments)
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .where(
        and(
          eq(workflowAssignments.permitId, permitId),
          eq(workflowAssignments.id, assignmentId),
        ),
      );

    if (!assignment) {
      throw new NotFoundException('Workflow assignment not found');
    }

    return assignment;
  }

  async getActiveAssignmentWithStep(permitId: string) {
    const [result] = await this.db
      .select({
        assignment: workflowAssignments,
        step: workflowSteps,
      })
      .from(workflowAssignments)
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .where(
        and(eq(workflowAssignments.permitId, permitId), eq(workflowAssignments.status, 'active')),
      );

    return result ?? null;
  }

  async completeAssignment(assignmentId: string, userId: string, db?: DbClient) {
    const [assignment] = await this.client(db)
      .update(workflowAssignments)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(workflowAssignments.id, assignmentId))
      .returning();

    return assignment;
  }

  /**
   * After an approve decision, determine whether the current (possibly parallel)
   * stage is complete and activate the next sequential wave.
   * FR-PTW-016 / FR-PTW-028 / FR-PTW-029
   */
  async resolveAfterApprove(
    permitId: string,
    currentStep: typeof workflowSteps.$inferSelect,
    userId: string,
    db?: DbClient,
  ): Promise<{ stageComplete: boolean; advanced: boolean; final: boolean }> {
    const client = this.client(db);

    if (currentStep.parallelGroup) {
      const peers = await client
        .select({
          assignment: workflowAssignments,
          step: workflowSteps,
          approval: permitApprovals,
        })
        .from(workflowAssignments)
        .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
        .leftJoin(
          permitApprovals,
          and(
            eq(permitApprovals.permitId, permitId),
            eq(permitApprovals.workflowStepId, workflowSteps.id),
          ),
        )
        .where(
          and(
            eq(workflowAssignments.permitId, permitId),
            eq(workflowSteps.parallelGroup, currentStep.parallelGroup),
          ),
        );

      const decisions = peers.map(
        (row) => (row.approval?.decision as 'approve' | 'reject' | 'defer' | undefined) ?? null,
      );
      const outcome = parallelStageOutcome(decisions);
      const quorum = currentStep.quorumMode === 'first' ? 'first' : 'all';

      if (outcome.rejected) {
        return { stageComplete: true, advanced: false, final: false };
      }

      const quorumMet =
        quorum === 'first' ? outcome.anyApprove : outcome.allApproved && outcome.pendingCount === 0;

      if (!quorumMet) {
        return { stageComplete: false, advanced: false, final: false };
      }

      // Mark remaining peer assignments skipped when first-response wins.
      if (quorum === 'first') {
        const pendingIds = peers
          .filter((row) => row.assignment.status === 'active' || row.assignment.status === 'pending')
          .map((row) => row.assignment.id)
          .filter((id) => id !== undefined);

        if (pendingIds.length > 0) {
          await client
            .update(workflowAssignments)
            .set({ status: 'skipped', completedAt: new Date(), updatedBy: userId })
            .where(inArray(workflowAssignments.id, pendingIds));
        }
      }

      const activated = await this.activateNextStep(permitId, currentStep.stepSequence, userId, db);
      return {
        stageComplete: true,
        advanced: Boolean(activated),
        final: !activated,
      };
    }

    const hasNext = await this.hasNextStep(permitId, currentStep.stepSequence, db);
    if (hasNext) {
      await this.activateNextStep(permitId, currentStep.stepSequence, userId, db);
      return { stageComplete: true, advanced: true, final: false };
    }

    return { stageComplete: true, advanced: false, final: true };
  }

  async activateNextStep(
    permitId: string,
    currentStepSequence: number,
    userId: string,
    db?: DbClient,
  ) {
    const steps = await this.client(db)
      .select({
        assignment: workflowAssignments,
        step: workflowSteps,
      })
      .from(workflowAssignments)
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .where(
        and(
          eq(workflowAssignments.permitId, permitId),
          eq(workflowAssignments.status, 'pending'),
        ),
      )
      .orderBy(asc(workflowSteps.stepSequence));

    const next = steps.find((row) => row.step.stepSequence > currentStepSequence);
    if (!next) {
      return null;
    }

    const nextGroup = next.step.parallelGroup;
    // Parallel peers may have distinct step_sequence values under the unique index;
    // activate the whole group together (FR-PTW-016).
    const toActivate = nextGroup
      ? steps.filter((row) => row.step.parallelGroup === nextGroup)
      : [next];

    let firstActivated: typeof workflowAssignments.$inferSelect | null = null;
    for (const row of toActivate) {
      const [activated] = await this.client(db)
        .update(workflowAssignments)
        .set({
          status: 'active',
          updatedBy: userId,
        })
        .where(eq(workflowAssignments.id, row.assignment.id))
        .returning();
      firstActivated ??= activated;
    }

    return firstActivated;
  }

  async hasNextStep(permitId: string, currentStepSequence: number, db?: DbClient) {
    const steps = await this.client(db)
      .select({ step: workflowSteps, assignment: workflowAssignments })
      .from(workflowAssignments)
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .where(eq(workflowAssignments.permitId, permitId))
      .orderBy(asc(workflowSteps.stepSequence));

    return steps.some(
      (row) =>
        row.step.stepSequence > currentStepSequence &&
        (row.assignment.status === 'pending' || row.assignment.status === 'active'),
    );
  }

  async listAssignmentsForPermit(permitId: string) {
    return this.db
      .select({
        assignment: workflowAssignments,
        step: workflowSteps,
      })
      .from(workflowAssignments)
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .where(eq(workflowAssignments.permitId, permitId))
      .orderBy(asc(workflowSteps.stepSequence));
  }

  async pauseSla(assignmentId: string, userId: string, db?: DbClient) {
    const [row] = await this.client(db)
      .update(workflowAssignments)
      .set({ slaPausedAt: new Date(), updatedBy: userId })
      .where(eq(workflowAssignments.id, assignmentId))
      .returning();
    return row;
  }

  userHasApproverRole(userRoles: string[], requiredRole: string): boolean {
    return userRoles.includes(requiredRole);
  }
}
