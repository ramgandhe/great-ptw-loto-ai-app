import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { gasTestingCatalogue, permitGasTesting, workstationCatalogue } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CreateGasTestingDto } from './dto/create-gas-testing.dto';
import { UpdateGasTestingDto } from './dto/update-gas-testing.dto';
import { MasterDataCacheService } from './master-data-cache.service';
import { MasterDataLogService } from './master-data-log.service';
import { ReferenceIntegrityService } from './reference-integrity.service';

@Injectable()
export class GasTestingService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cacheService: MasterDataCacheService,
    private readonly auditService: AuditService,
    private readonly logService: MasterDataLogService,
    private readonly referenceIntegrity: ReferenceIntegrityService,
  ) {}

  async create(dto: CreateGasTestingDto, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    this.assertRange(dto.minimum, dto.maximum);
    await this.assertWorkstationExists(tenantId, dto.workstationId);

    try {
      const [row] = await this.db
        .insert(gasTestingCatalogue)
        .values({
          tenantId,
          workstationId: dto.workstationId,
          parameter: dto.parameter.trim(),
          unit: dto.unit.trim(),
          minimum: dto.minimum,
          maximum: dto.maximum,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.afterMutation(tenantId, user, 'gas_testing.created', row.id);
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('This parameter already exists for the selected workstation');
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser, workstationId?: string) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const cacheKey = workstationId ? `gas-testing:${workstationId}` : 'gas-testing';
    const cached = await this.cacheService.get<(typeof gasTestingCatalogue.$inferSelect)[]>(
      tenantId,
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const conditions = [eq(gasTestingCatalogue.tenantId, tenantId)];
    if (workstationId) {
      conditions.push(eq(gasTestingCatalogue.workstationId, workstationId));
    }

    const rows = await this.db
      .select()
      .from(gasTestingCatalogue)
      .where(and(...conditions));

    await this.cacheService.set(tenantId, cacheKey, rows);
    return rows;
  }

  async update(id: string, dto: UpdateGasTestingDto, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    if (dto.workstationId) {
      await this.assertWorkstationExists(tenantId, dto.workstationId);
    }

    const [existing] = await this.db
      .select()
      .from(gasTestingCatalogue)
      .where(and(eq(gasTestingCatalogue.id, id), eq(gasTestingCatalogue.tenantId, tenantId)));
    if (!existing) {
      throw new ConflictException('Gas testing item not found');
    }

    const minimum = dto.minimum ?? existing.minimum;
    const maximum = dto.maximum ?? existing.maximum;
    this.assertRange(minimum, maximum);

    try {
      const [row] = await this.db
        .update(gasTestingCatalogue)
        .set({
          ...(dto.workstationId !== undefined ? { workstationId: dto.workstationId } : {}),
          ...(dto.parameter !== undefined ? { parameter: dto.parameter.trim() } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
          ...(dto.minimum !== undefined ? { minimum: dto.minimum } : {}),
          ...(dto.maximum !== undefined ? { maximum: dto.maximum } : {}),
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(and(eq(gasTestingCatalogue.id, id), eq(gasTestingCatalogue.tenantId, tenantId)))
        .returning();

      await this.afterMutation(tenantId, user, 'gas_testing.updated', id);
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('This parameter already exists for the selected workstation');
      }
      throw error;
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const [referenced] = await this.db
      .select({ id: permitGasTesting.id })
      .from(permitGasTesting)
      .where(eq(permitGasTesting.gasTestingCatalogueId, id));
    if (referenced) {
      throw new ConflictException('This gas testing item is used on a permit and cannot be deleted');
    }

    const [row] = await this.db
      .delete(gasTestingCatalogue)
      .where(and(eq(gasTestingCatalogue.id, id), eq(gasTestingCatalogue.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new ConflictException('Gas testing item not found');
    }

    await this.afterMutation(tenantId, user, 'gas_testing.deleted', id);
    return row;
  }

  private assertRange(minimum: number, maximum: number) {
    if (minimum >= maximum) {
      throw new BadRequestException('Minimum must be less than maximum');
    }
  }

  private async assertWorkstationExists(tenantId: string, workstationId: string) {
    const [row] = await this.db
      .select({ id: workstationCatalogue.id })
      .from(workstationCatalogue)
      .where(
        and(eq(workstationCatalogue.id, workstationId), eq(workstationCatalogue.tenantId, tenantId)),
      );
    if (!row) {
      throw new NotFoundException('Workstation not found for this tenant');
    }
  }

  private async afterMutation(
    tenantId: string,
    user: AuthenticatedUser,
    action: string,
    entityId: string,
  ) {
    await this.cacheService.invalidate(tenantId);
    await this.auditService.log({
      action,
      entityType: 'gas_testing_catalogue',
      entityId,
      userId: user.id,
      tenantId,
    });
    this.logService.logEvent({
      action,
      entityType: 'gas_testing_catalogue',
      entityId,
      tenantId,
      userId: user.id,
    });
  }
}
