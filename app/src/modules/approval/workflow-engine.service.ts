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

    return this.client(db)
      .insert(workflowAssignments)
      .values(
        steps.map((step, index) => ({
          permitId,
          workflowStepId: step.id,
          assigneeId: submittedBy,
          status: (index === 0 ? 'active' : 'pending') satisfies AssignmentStatus,
          createdBy: submittedBy,
          updatedBy: submittedBy,
        })),
      )
      .returning();
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

  async getActiveAssignment(permitId: string) {
    const [assignment] = await this.db
      .select()
      .from(workflowAssignments)
      .where(
        and(eq(workflowAssignments.permitId, permitId), eq(workflowAssignments.status, 'active')),
      );

    return assignment ?? null;
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

    const [activated] = await this.client(db)
      .update(workflowAssignments)
      .set({
        status: 'active',
        updatedBy: userId,
      })
      .where(eq(workflowAssignments.id, next.assignment.id))
      .returning();

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
}
