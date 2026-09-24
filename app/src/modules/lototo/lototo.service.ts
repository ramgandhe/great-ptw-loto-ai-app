import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  isolationPoints,
  isolationSequences,
  lototoAssignments,
  lototoPlans,
  permitLototo,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { AssignPersonnelDto } from './dto/assign-personnel.dto';
import { CreateLototoPlanDto } from './dto/create-lototo-plan.dto';
import { LototoCacheService } from './lototo-cache.service';
import { LototoLogService } from './lototo-log.service';
import { LototoValidationService } from './lototo-validation.service';
import { NotificationService } from './notification.service';

@Injectable()
export class LototoService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
    private readonly lototoLogService: LototoLogService,
    private readonly lototoCacheService: LototoCacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateLototoPlanDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);

    await this.validationService.assertMachineryExists(tenantId, dto.machineryId);

    if (dto.workstationId) {
      await this.validationService.assertWorkstationExists(tenantId, dto.workstationId);
    }

    try {
      const [plan] = await this.db
        .insert(lototoPlans)
        .values({
          tenantId,
          workstationId: dto.workstationId,
          machineryId: dto.machineryId,
          reference: dto.reference,
          title: dto.title,
          description: dto.description,
          status: 'draft',
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.auditService.log({
        action: 'lototo.plan.created',
        entityType: 'lototo_plan',
        entityId: plan.id,
        userId: user.id,
        tenantId,
        metadata: { machineryId: dto.machineryId },
      });

      this.lototoLogService.logEvent({
        action: 'lototo.plan.created',
        planId: plan.id,
        tenantId,
        userId: user.id,
      });

      await this.lototoCacheService.invalidateTenant(tenantId);
      await this.notificationService.enqueuePlanningNotification({
        planId: plan.id,
        tenantId,
        action: 'plan_created',
        actorId: user.id,
      });

      return plan;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('LOTOTO plan reference already exists for this tenant');
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser, permitId?: string, machineryId?: string) {
    const tenantId = this.validationService.requireTenant(user);

    const cacheKey = machineryId ?? permitId;
    const cached = await this.lototoCacheService.getPlanList<
      (typeof lototoPlans.$inferSelect)[]
    >(tenantId, cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [eq(lototoPlans.tenantId, tenantId)];
    if (machineryId) {
      conditions.push(eq(lototoPlans.machineryId, machineryId));
    }

    let plans;
    if (permitId && !machineryId) {
      const rows = await this.db
        .select({ plan: lototoPlans })
        .from(permitLototo)
        .innerJoin(lototoPlans, eq(permitLototo.lototoPlanId, lototoPlans.id))
        .where(and(eq(permitLototo.permitId, permitId), eq(lototoPlans.tenantId, tenantId)))
        .orderBy(desc(lototoPlans.createdAt));
      const mapped = rows.map((row) => row.plan);
      await this.lototoCacheService.setPlanList(tenantId, cacheKey, mapped);
      return mapped;
    }

    plans = await this.db
      .select()
      .from(lototoPlans)
      .where(and(...conditions))
      .orderBy(desc(lototoPlans.createdAt));

    await this.lototoCacheService.setPlanList(tenantId, cacheKey, plans);
    return plans;
  }

  async findOne(planId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);

    const cached = await this.lototoCacheService.getPlanDetail<{
      plan: typeof lototoPlans.$inferSelect;
      isolationPoints: (typeof isolationPoints.$inferSelect)[];
      assignments: (typeof lototoAssignments.$inferSelect)[];
      sequence: (typeof isolationSequences.$inferSelect)[];
    }>(tenantId, planId);
    if (cached) {
      return cached;
    }

    const plan = await this.validationService.getPlan(planId, tenantId);
    const [points, assignments, sequence] = await Promise.all([
      this.db
        .select()
        .from(isolationPoints)
        .where(eq(isolationPoints.planId, planId))
        .orderBy(asc(isolationPoints.isolationNumber)),
      this.db
        .select()
        .from(lototoAssignments)
        .where(eq(lototoAssignments.planId, planId))
        .orderBy(desc(lototoAssignments.assignedAt)),
      this.db
        .select()
        .from(isolationSequences)
        .where(eq(isolationSequences.planId, planId))
        .orderBy(asc(isolationSequences.sequenceOrder)),
    ]);

    const detail = { plan, isolationPoints: points, assignments, sequence };
    await this.lototoCacheService.setPlanDetail(tenantId, planId, detail);
    return detail;
  }

  async assignPersonnel(planId: string, dto: AssignPersonnelDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const plan = await this.validationService.getEditablePlan(planId, tenantId);

    try {
      const [assignment] = await this.db
        .insert(lototoAssignments)
        .values({
          planId,
          workforceUserId: dto.workforceUserId,
          role: dto.role,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.auditService.log({
        action: 'lototo.assignment.created',
        entityType: 'lototo_assignment',
        entityId: assignment.id,
        userId: user.id,
        tenantId,
        metadata: { planId, role: dto.role },
      });

      this.lototoLogService.logEvent({
        action: 'lototo.assignment.created',
        planId,
        permitId: plan.permitId ?? undefined,
        tenantId,
        userId: user.id,
        metadata: { role: dto.role, workforceUserId: dto.workforceUserId },
      });

      await this.lototoCacheService.invalidatePlan(tenantId, planId, plan.permitId ?? undefined);
      await this.notificationService.enqueuePlanningNotification({
        planId,
        permitId: plan.permitId ?? undefined,
        tenantId,
        action: 'assignment_created',
        actorId: user.id,
        metadata: { role: dto.role },
      });

      return assignment;
    } catch (error) {
      if (error instanceof Error && error.message.includes('configuration is locked')) {
        throw new ConflictException('LOTOTO plan configuration is locked once execution has begun');
      }
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('This personnel assignment already exists on the plan');
      }
      throw error;
    }
  }
}
