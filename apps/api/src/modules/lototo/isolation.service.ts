import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { isolationPoints } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { AddIsolationPointDto } from './dto/add-isolation-point.dto';
import { EquipmentService } from './equipment.service';
import { LototoLogService } from './lototo-log.service';
import { LototoValidationService } from './lototo-validation.service';

@Injectable()
export class IsolationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly equipmentService: EquipmentService,
    private readonly auditService: AuditService,
    private readonly lototoLogService: LototoLogService,
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
        permitId: plan.permitId,
        tenantId,
        userId: user.id,
        metadata: { isolationPointId: point.id },
      });

      return point;
    } catch (error) {
      if (error instanceof Error && error.message.includes('configuration is locked')) {
        throw new ConflictException('LOTOTO plan configuration is locked once execution has begun');
      }
      throw error;
    }
  }
}
