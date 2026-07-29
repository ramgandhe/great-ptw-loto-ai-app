import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { hazardCategories } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CreateHazardDto } from './dto/create-hazard.dto';
import { MasterDataCacheService } from './master-data-cache.service';
import { MasterDataLogService } from './master-data-log.service';
import { ReferenceIntegrityService } from './reference-integrity.service';

@Injectable()
export class HazardService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cacheService: MasterDataCacheService,
    private readonly auditService: AuditService,
    private readonly logService: MasterDataLogService,
    private readonly referenceIntegrity: ReferenceIntegrityService,
  ) {}

  async create(dto: CreateHazardDto, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);

    try {
      const [row] = await this.db
        .insert(hazardCategories)
        .values({
          tenantId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          description: dto.description,
          severity: dto.severity ?? 'medium',
          isActive: dto.isActive ?? true,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.afterMutation(tenantId, user, 'hazard.created', row.id);
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException(`Hazard code '${dto.code}' already exists`);
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const cached = await this.cacheService.get<(typeof hazardCategories.$inferSelect)[]>(
      tenantId,
      'hazards',
    );
    if (cached) {
      return cached;
    }

    const rows = await this.db
      .select()
      .from(hazardCategories)
      .where(eq(hazardCategories.tenantId, tenantId));

    await this.cacheService.set(tenantId, 'hazards', rows);
    return rows;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    await this.referenceIntegrity.assertHazardCategoryNotReferenced(id);

    const [row] = await this.db
      .delete(hazardCategories)
      .where(and(eq(hazardCategories.id, id), eq(hazardCategories.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new ConflictException('Hazard category not found');
    }

    await this.afterMutation(tenantId, user, 'hazard.deleted', id);
    return row;
  }

  private async afterMutation(
    tenantId: string,
    user: AuthenticatedUser,
    action: string,
    entityId: string,
  ) {
    await this.cacheService.invalidate(tenantId, 'hazards');
    await this.auditService.log({
      action,
      entityType: 'hazard_category',
      entityId,
      userId: user.id,
      tenantId,
    });
    this.logService.logEvent({
      action,
      tenantId,
      userId: user.id,
      entityType: 'hazard_category',
      entityId,
    });
  }
}
