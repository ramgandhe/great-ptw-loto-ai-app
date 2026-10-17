import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { hazardCategories, hazardPpe, ppeCatalogue } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CreateHazardDto } from './dto/create-hazard.dto';
import { MasterDataCacheService } from './master-data-cache.service';
import { MasterDataLogService } from './master-data-log.service';
import { ensureDefaultHazards } from './default-hazards';
import { ReferenceIntegrityService } from './reference-integrity.service';

function trimLines(values?: string[]): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

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
          category: dto.category.trim(),
          description: dto.description,
          severity: dto.severity ?? 'medium',
          consequences: trimLines(dto.consequences),
          risks: trimLines(dto.risks),
          controls: trimLines(dto.controls),
          permitTypeCodes: trimLines(dto.permitTypeCodes),
          isActive: dto.isActive ?? true,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.replacePpe(tenantId, row.id, dto.ppeIds ?? [], user.id);
      await this.afterMutation(tenantId, user, 'hazard.created', row.id);
      return { ...row, ppeIds: dto.ppeIds ?? [] };
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException(`Hazard code '${dto.code}' already exists`);
      }
      throw error;
    }
  }

  async update(id: string, dto: Partial<CreateHazardDto>, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const [row] = await this.db
      .update(hazardCategories)
      .set({
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.consequences !== undefined ? { consequences: trimLines(dto.consequences) } : {}),
        ...(dto.risks !== undefined ? { risks: trimLines(dto.risks) } : {}),
        ...(dto.controls !== undefined ? { controls: trimLines(dto.controls) } : {}),
        ...(dto.permitTypeCodes !== undefined ? { permitTypeCodes: trimLines(dto.permitTypeCodes) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(hazardCategories.id, id), eq(hazardCategories.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new ConflictException('Hazard category not found');
    }

    if (dto.ppeIds !== undefined) await this.replacePpe(tenantId, row.id, dto.ppeIds, user.id);
    await this.afterMutation(tenantId, user, 'hazard.updated', row.id);
    const ppeIds = await this.ppeIdsFor(tenantId, [row.id]);
    return { ...row, ppeIds: ppeIds.get(row.id) ?? [] };
  }

  async importDefaults(user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const result = await ensureDefaultHazards(this.db, tenantId, user.id);
    await this.cacheService.invalidate(tenantId, 'hazards-v2');
    if (result.created + result.updated > 0) {
      await this.auditService.log({
        action: 'hazard.defaults-imported',
        entityType: 'hazard_category',
        entityId: tenantId,
        userId: user.id,
        tenantId,
        metadata: result,
      });
    }
    return result;
  }

  async findAll(user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const cached = await this.cacheService.get<Array<typeof hazardCategories.$inferSelect & { ppeIds: string[] }>>(
      tenantId,
      'hazards-v2',
    );
    if (cached) {
      return cached;
    }

    const rows = await this.db
      .select()
      .from(hazardCategories)
      .where(eq(hazardCategories.tenantId, tenantId));
    const ppeIds = await this.ppeIdsFor(
      tenantId,
      rows.map((row) => row.id),
    );
    const enriched = rows.map((row) => ({ ...row, ppeIds: ppeIds.get(row.id) ?? [] }));

    await this.cacheService.set(tenantId, 'hazards-v2', enriched);
    return enriched;
  }

  async remove(id: string, user: AuthenticatedUser, force = false) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    await this.referenceIntegrity.assertHazardCategoryNotReferenced(id, force);

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

  private async ppeIdsFor(tenantId: string, hazardIds: string[]) {
    const byHazard = new Map<string, string[]>();
    if (hazardIds.length === 0) return byHazard;
    const links = await this.db
      .select({
        hazardCategoryId: hazardPpe.hazardCategoryId,
        ppeCatalogueId: hazardPpe.ppeCatalogueId,
      })
      .from(hazardPpe)
      .where(and(eq(hazardPpe.tenantId, tenantId), inArray(hazardPpe.hazardCategoryId, hazardIds)));
    for (const link of links) {
      const list = byHazard.get(link.hazardCategoryId) ?? [];
      list.push(link.ppeCatalogueId);
      byHazard.set(link.hazardCategoryId, list);
    }
    return byHazard;
  }

  private async replacePpe(tenantId: string, hazardId: string, ppeIds: string[], userId: string) {
    const unique = [...new Set(ppeIds)];
    if (unique.length > 0) {
      const rows = await this.db
        .select({ id: ppeCatalogue.id })
        .from(ppeCatalogue)
        .where(and(eq(ppeCatalogue.tenantId, tenantId), inArray(ppeCatalogue.id, unique)));
      if (rows.length !== unique.length) {
        throw new BadRequestException('One or more PPE items are not in this organisation');
      }
    }
    await this.db.delete(hazardPpe).where(eq(hazardPpe.hazardCategoryId, hazardId));
    if (unique.length === 0) return;
    await this.db.insert(hazardPpe).values(
      unique.map((ppeCatalogueId) => ({
        tenantId,
        hazardCategoryId: hazardId,
        ppeCatalogueId,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private async afterMutation(
    tenantId: string,
    user: AuthenticatedUser,
    action: string,
    entityId: string,
  ) {
    await this.cacheService.invalidate(tenantId, 'hazards-v2');
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
