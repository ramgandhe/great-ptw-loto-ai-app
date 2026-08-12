import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  workflowAssignments,
  workflowSteps,
  permitApprovals,
  type AssignmentStatus,
} from '../../database/schema';

type DbClient = Pick<Database, 'insert' | 'update' | 'select' | 'delete'>;

@Injectable()
export class WorkflowEngineService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  private client(db?: DbClient): DbClient {
    return db ?? this.db;
  }

  async resolveSteps(tenantId: string, permitTypeId: string) {
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

    if (typeSpecific.length > 0) {
      return typeSpecific;
    }

    return this.db
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
  }

  async initializeAtSubmit(
    permitId: string,
    tenantId: string,
    permitTypeId: string,
    submittedBy: string,
    db?: DbClient,
  ) {
    await this.resetWorkflow(permitId, db);

    const steps = await this.resolveSteps(tenantId, permitTypeId);
    if (steps.length === 0) {
      throw new BadRequestException('No approval workflow configured for this permit type');
    }

    const values: Array<{
      permitId: string;
      workflowStepId: string;
      assigneeId: string;
      assignmentSlot: string;
      status: AssignmentStatus;
      slaDeadlineAt?: Date;
      createdBy: string;
      updatedBy: string;
    }> = [];

    let firstSequence: number | null = null;

    for (const step of steps) {
      const isFirst = firstSequence === null || step.stepSequence === firstSequence;
      if (firstSequence === null) {
        firstSequence = step.stepSequence;
      }

      const roles =
        step.stageMode === 'parallel' && step.parallelRoles?.length
          ? step.parallelRoles
          : [step.approverRole];

      for (const role of roles) {
        values.push({
          permitId,
          workflowStepId: step.id,
          assigneeId: submittedBy,
          assignmentSlot: step.stageMode === 'parallel' ? role : 'default',
          status: isFirst ? 'active' : 'pending',
          slaDeadlineAt: isFirst && step.slaHours ? this.slaDeadline(step.slaHours) : undefined,
          createdBy: submittedBy,
          updatedBy: submittedBy,
        });
      }
    }

    return this.client(db).insert(workflowAssignments).values(values).returning();
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

    return this.initializeAtSubmit(permitId, tenantId, permitTypeId, actorId);
  }

  async getActiveAssignments(permitId: string, db?: DbClient) {
    return this.client(db)
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

  async getActiveAssignment(permitId: string) {
    const rows = await this.getActiveAssignments(permitId);
    return rows[0]?.assignment ?? null;
  }

  async getActiveAssignmentWithStep(permitId: string) {
    const rows = await this.getActiveAssignments(permitId);
    return rows[0] ?? null;
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

  async isParallelStageComplete(
    permitId: string,
    stepId: string,
    quorumMode: string,
    db?: DbClient,
  ): Promise<boolean> {
    const assignments = await this.client(db)
      .select()
      .from(workflowAssignments)
      .where(
        and(
          eq(workflowAssignments.permitId, permitId),
          eq(workflowAssignments.workflowStepId, stepId),
        ),
      );

    if (quorumMode === 'first') {
      return assignments.some((row) => row.status === 'completed');
    }

    return assignments.every((row) => row.status === 'completed' || row.status === 'skipped');
  }

  async completeParallelStage(
    permitId: string,
    stepId: string,
    userId: string,
    db?: DbClient,
  ) {
    await this.client(db)
      .update(workflowAssignments)
      .set({ status: 'skipped', updatedBy: userId })
      .where(
        and(
          eq(workflowAssignments.permitId, permitId),
          eq(workflowAssignments.workflowStepId, stepId),
          eq(workflowAssignments.status, 'active'),
        ),
      );
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

    const nextSequence = steps.find((row) => row.step.stepSequence > currentStepSequence)?.step
      .stepSequence;

    if (!nextSequence) {
      return [];
    }

    const nextRows = steps.filter((row) => row.step.stepSequence === nextSequence);
    const activated = [];

    for (const row of nextRows) {
      const [item] = await this.client(db)
        .update(workflowAssignments)
        .set({
          status: 'active',
          slaDeadlineAt: row.step.slaHours ? this.slaDeadline(row.step.slaHours) : null,
          updatedBy: userId,
        })
        .where(eq(workflowAssignments.id, row.assignment.id))
        .returning();
      activated.push(item);
    }

    return activated;
  }

  async hasNextStep(permitId: string, currentStepSequence: number, db?: DbClient) {
    const steps = await this.client(db)
      .select({ step: workflowSteps })
      .from(workflowAssignments)
      .innerJoin(workflowSteps, eq(workflowAssignments.workflowStepId, workflowSteps.id))
      .where(eq(workflowAssignments.permitId, permitId))
      .orderBy(asc(workflowSteps.stepSequence));

    return steps.some((row) => row.step.stepSequence > currentStepSequence);
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

  userHasApproverRole(userRoles: string[], requiredRole: string): boolean {
    return userRoles.includes(requiredRole);
  }

  resolveApproverRoleForAssignment(
    userRoles: string[],
    step: typeof workflowSteps.$inferSelect,
    assignmentSlot: string,
  ): string | null {
    if (step.stageMode === 'parallel') {
      const role = assignmentSlot;
      return userRoles.includes(role) ? role : null;
    }

    return userRoles.includes(step.approverRole) ? step.approverRole : null;
  }

  private slaDeadline(hours: number): Date {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
}
