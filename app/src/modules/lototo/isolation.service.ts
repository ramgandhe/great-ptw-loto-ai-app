import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { isolationPoints } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { AddIsolationPointDto } from './dto/add-isolation-point.dto';
import { EquipmentService } from './equipment.service';
import { LototoCacheService } from './lototo-cache.service';
import { LototoLogService } from './lototo-log.service';
import { LototoValidationService } from './lototo-validation.service';
import { NotificationService } from './notification.service';

@Injectable()
export class IsolationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly equipmentService: EquipmentService,
    private readonly auditService: AuditService,
    private readonly lototoLogService: LototoLogService,
    private readonly lototoCacheService: LototoCacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async addIsolationPoint(planId: string, dto: AddIsolationPointDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const plan = await this.validationService.getEditablePlan(planId, tenantId);

    await this.validationService.assertMachineryExists(tenantId, dto.machineryId);
    await this.validationService.assertIsolationNumberAvailable(planId, dto.isolationNumber);

    const equipmentEnergySourceId = await this.equipmentService.resolveEnergySourceId(
      planId,
      dto.machineryId,
      user.id,
      dto.equipmentEnergySourceId,
      dto.energySource,
    );

    try {
      const [point] = await this.db
        .insert(isolationPoints)
        .values({
          planId,
          machineryId: dto.machineryId,
          equipmentEnergySourceId,
          isolationNumber: dto.isolationNumber,
          description: dto.description,
          verificationRequired: dto.verificationRequired ?? true,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.auditService.log({
        action: 'lototo.isolation_point.added',
        entityType: 'isolation_point',
        entityId: point.id,
        userId: user.id,
        tenantId,
        metadata: { planId, isolationNumber: dto.isolationNumber },
      });

      this.lototoLogService.logEvent({
        action: 'lototo.isolation_point.added',
        planId,
        permitId: plan.permitId ?? undefined,
        tenantId,
        userId: user.id,
        metadata: { isolationPointId: point.id },
      });

      await this.lototoCacheService.invalidatePlan(tenantId, planId, plan.permitId ?? undefined);
      await this.notificationService.enqueuePlanningNotification({
        planId,
        permitId: plan.permitId ?? undefined,
        tenantId,
        action: 'isolation_point_added',
        actorId: user.id,
        metadata: { isolationNumber: dto.isolationNumber },
      });

      return point;
    } catch (error) {
      if (error instanceof Error && error.message.includes('configuration is locked')) {
        throw new ConflictException('LOTOTO plan configuration is locked once execution has begun');
      }
      throw error;
    }
  }

  /** Only while the plan is still being set up; its sequence steps go with it. Used points are kept for the record. */
  async removeIsolationPoint(planId: string, pointId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const plan = await this.validationService.getEditablePlan(planId, tenantId);
    const [point] = await this.db
      .delete(isolationPoints)
      .where(and(eq(isolationPoints.id, pointId), eq(isolationPoints.planId, planId)))
      .returning()
      .catch(() => {
        throw new ConflictException('This isolation point has been used in an isolation and cannot be deleted');
      });
    if (!point) {
      throw new NotFoundException('Isolation point not found');
    }
    await this.auditService.log({
      action: 'lototo.isolation_point.removed',
      entityType: 'isolation_point',
      entityId: point.id,
      userId: user.id,
      tenantId,
      metadata: { planId, isolationNumber: point.isolationNumber },
    });
    await this.lototoCacheService.invalidatePlan(tenantId, planId, plan.permitId ?? undefined);
    return { removed: point.id };
  }
}
