import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { isolationPoints, isolationSequences, lototoPlans } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { ConfigureSequenceDto } from './dto/configure-sequence.dto';
import { LototoCacheService } from './lototo-cache.service';
import { LototoLogService } from './lototo-log.service';
import { LototoValidationService } from './lototo-validation.service';
import { NotificationService } from './notification.service';

@Injectable()
export class SequenceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
    private readonly lototoLogService: LototoLogService,
    private readonly lototoCacheService: LototoCacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async configureSequence(planId: string, dto: ConfigureSequenceDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const plan = await this.validationService.getEditablePlan(planId, tenantId);

    this.validationService.assertSequenceStepsValid(dto.steps);

    const pointIds = dto.steps.map((step) => step.isolationPointId);
    const points = await this.db
      .select()
      .from(isolationPoints)
      .where(and(eq(isolationPoints.planId, planId), inArray(isolationPoints.id, pointIds)));

    if (points.length !== pointIds.length) {
      throw new BadRequestException('All isolation points in the sequence must belong to this plan');
    }

    try {
      return await this.db.transaction(async (tx) => {
        await tx.delete(isolationSequences).where(eq(isolationSequences.planId, planId));

        const rows = await tx
          .insert(isolationSequences)
          .values(
            dto.steps.map((step) => ({
              planId,
              isolationPointId: step.isolationPointId,
              sequenceOrder: step.sequenceOrder,
              requiresVerification: step.requiresVerification ?? true,
              createdBy: user.id,
              updatedBy: user.id,
            })),
          )
          .returning();

        await tx
          .update(lototoPlans)
          .set({ status: 'ready', updatedBy: user.id })
          .where(eq(lototoPlans.id, planId));

        await this.auditService.log({
          action: 'lototo.sequence.configured',
          entityType: 'lototo_plan',
          entityId: planId,
          userId: user.id,
          tenantId,
          metadata: { stepCount: rows.length },
        });

        this.lototoLogService.logEvent({
          action: 'lototo.sequence.configured',
          planId,
          permitId: plan.permitId,
          tenantId,
          userId: user.id,
          metadata: { stepCount: rows.length },
        });

        await this.lototoCacheService.invalidatePlan(tenantId, planId, plan.permitId);
        await this.notificationService.enqueuePlanningNotification({
          planId,
          permitId: plan.permitId,
          tenantId,
          action: 'sequence_configured',
          actorId: user.id,
          metadata: { stepCount: rows.length },
        });

        return rows;
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('configuration is locked')) {
        throw new ConflictException('LOTOTO plan configuration is locked once execution has begun');
      }
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('Isolation sequence order values must be unique');
      }
      throw error;
    }
  }
}
