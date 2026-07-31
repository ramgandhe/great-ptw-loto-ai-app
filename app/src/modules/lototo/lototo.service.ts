import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { lototoAssignments, lototoPlans } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { PermitService } from '../permit/permit.service';
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
    private readonly permitService: PermitService,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
    private readonly lototoLogService: LototoLogService,
    private readonly lototoCacheService: LototoCacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateLototoPlanDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);

    await this.permitService.findOne(dto.permitId, user);

    if (dto.workstationId) {
      await this.validationService.assertWorkstationExists(tenantId, dto.workstationId);
    }

    if (dto.machineryId) {
      await this.validationService.assertMachineryExists(tenantId, dto.machineryId);
    }

    try {
      const [plan] = await this.db
        .insert(lototoPlans)
        .values({
          tenantId,
          permitId: dto.permitId,
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
        metadata: { permitId: dto.permitId },
      });

      this.lototoLogService.logEvent({
        action: 'lototo.plan.created',
        planId: plan.id,
        permitId: dto.permitId,
        tenantId,
        userId: user.id,
      });

      await this.lototoCacheService.invalidateTenant(tenantId);
      await this.notificationService.enqueuePlanningNotification({
        planId: plan.id,
        permitId: dto.permitId,
        tenantId,
        action: 'plan_created',
        actorId: user.id,
      });

      return plan;
    } catch (error) {
      if (error instanceof Error && error.message.includes('require an existing permit')) {
        throw new ConflictException('LOTOTO plans require an existing permit');
      }
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('LOTOTO plan reference already exists for this tenant');
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser, permitId?: string) {
    const tenantId = this.validationService.requireTenant(user);

    const cached = await this.lototoCacheService.getPlanList<
      (typeof lototoPlans.$inferSelect)[]
    >(tenantId, permitId);
    if (cached) {
      return cached;
    }

    const conditions = [eq(lototoPlans.tenantId, tenantId)];
    if (permitId) {
      conditions.push(eq(lototoPlans.permitId, permitId));
    }

    const plans = await this.db
      .select()
      .from(lototoPlans)
      .where(and(...conditions))
      .orderBy(desc(lototoPlans.createdAt));

    await this.lototoCacheService.setPlanList(tenantId, permitId, plans);
    return plans;
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
        permitId: plan.permitId,
        tenantId,
        userId: user.id,
        metadata: { role: dto.role, workforceUserId: dto.workforceUserId },
      });

      await this.lototoCacheService.invalidatePlan(tenantId, planId, plan.permitId);
      await this.notificationService.enqueuePlanningNotification({
        planId,
        permitId: plan.permitId,
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
