import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { throwInUse } from '../../common/http/in-use';
import { and, eq, inArray, or } from 'drizzle-orm';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  assets,
  gasTestingCatalogue,
  permitGasTesting,
  siteMembers,
  workLocations,
  workstationCatalogue,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CreateGasTestingDto } from './dto/create-gas-testing.dto';
import { UpdateGasTestingDto } from './dto/update-gas-testing.dto';
import { GasLimitInput, mergeGasLimits, widerThanAny } from './gas-test-defaults';
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
    const target = this.oneTarget(dto);
    const parameter = dto.parameter.trim();
    let workstationId: string | null = null;
    let workLocationId: string | null = null;
    let assetId: string | null = null;
    if (target === 'workstation') {
      await this.assertWorkstationExists(tenantId, dto.workstationId!);
      workstationId = dto.workstationId!;
      workLocationId = await this.locationIdFor(tenantId, workstationId);
    } else if (target === 'location') {
      await this.assertLocation(tenantId, dto.workLocationId!);
      workLocationId = dto.workLocationId!;
    } else {
      await this.assertAsset(tenantId, dto.assetId!);
      assetId = dto.assetId!;
    }
    if (workLocationId) {
      await this.assertNotWiderThanAncestors(tenantId, workLocationId, parameter, dto.minimum, dto.maximum);
    }

    try {
      const [row] = await this.db
        .insert(gasTestingCatalogue)
        .values({
          tenantId,
          workstationId,
          workLocationId,
          assetId,
          parameter,
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
        throw new ConflictException('This parameter already exists for the selected place or asset');
      }
      throw error;
    }
  }

  async defaults(user: AuthenticatedUser, workLocationId: string, assetIds: string[]) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const chain: Array<{ id: string; name: string; parentId: string | null; siteId: string }> = [];
    const seen = new Set<string>();
    let current: string | null = workLocationId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const [location] = await this.db
        .select({
          id: workLocations.id,
          name: workLocations.name,
          parentId: workLocations.parentId,
          siteId: workLocations.siteId,
        })
        .from(workLocations)
        .where(and(eq(workLocations.id, current), eq(workLocations.tenantId, tenantId)));
      if (!location) throw new NotFoundException('Work location not found');
      chain.push(location);
      current = location.parentId;
    }
    if (chain.length === 0) throw new NotFoundException('Work location not found');
    await this.assertSiteAccess(tenantId, chain[0].siteId, user);

    const locationIds = chain.map((row) => row.id);
    const locationRows = await this.db
      .select()
      .from(gasTestingCatalogue)
      .where(
        and(
          eq(gasTestingCatalogue.tenantId, tenantId),
          eq(gasTestingCatalogue.isActive, true),
          or(
            inArray(gasTestingCatalogue.workLocationId, locationIds),
            inArray(gasTestingCatalogue.workstationId, locationIds),
          ),
        ),
      );
    const assetRows = assetIds.length
      ? await this.db
          .select()
          .from(gasTestingCatalogue)
          .where(
            and(
              eq(gasTestingCatalogue.tenantId, tenantId),
              eq(gasTestingCatalogue.isActive, true),
              inArray(gasTestingCatalogue.assetId, assetIds),
            ),
          )
      : [];
    const assetNames = assetIds.length
      ? await this.db
          .select({ id: assets.id, name: assets.name, tag: assets.tag })
          .from(assets)
          .where(and(eq(assets.tenantId, tenantId), inArray(assets.id, assetIds)))
      : [];
    const locationName = new Map(chain.map((row) => [row.id, row.name]));
    const assetName = new Map(assetNames.map((row) => [row.id, row.tag || row.name]));
    const limits: GasLimitInput[] = [];
    for (const row of locationRows) {
      const sourceId = row.workLocationId ?? row.workstationId;
      if (!sourceId || !locationIds.includes(sourceId)) continue;
      limits.push({
        parameter: row.parameter,
        unit: row.unit,
        minimum: row.minimum,
        maximum: row.maximum,
        source: { kind: 'work_location', id: sourceId, name: locationName.get(sourceId) ?? row.parameter },
        catalogueId: row.id,
      });
    }
    for (const row of assetRows) {
      if (!row.assetId) continue;
      limits.push({
        parameter: row.parameter,
        unit: row.unit,
        minimum: row.minimum,
        maximum: row.maximum,
        source: { kind: 'asset', id: row.assetId, name: assetName.get(row.assetId) ?? row.parameter },
        catalogueId: row.id,
      });
    }
    return mergeGasLimits(limits);
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
    if (dto.workLocationId && dto.assetId) {
      throw new BadRequestException('A gas test is stored on a work location or an asset');
    }
    if (dto.workstationId) {
      await this.assertWorkstationExists(tenantId, dto.workstationId);
    }
    if (dto.workLocationId) {
      await this.assertLocation(tenantId, dto.workLocationId);
    }
    if (dto.assetId) {
      await this.assertAsset(tenantId, dto.assetId);
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
    const parameter = dto.parameter?.trim() ?? existing.parameter;
    const workLocationId = dto.assetId ? null : (dto.workLocationId ?? existing.workLocationId);
    if (
      workLocationId &&
      (dto.minimum !== undefined || dto.maximum !== undefined || dto.parameter !== undefined || dto.workLocationId)
    ) {
      await this.assertNotWiderThanAncestors(tenantId, workLocationId, parameter, minimum, maximum);
    }

    try {
      const [row] = await this.db
        .update(gasTestingCatalogue)
        .set({
          ...(dto.workstationId !== undefined
            ? { workstationId: dto.workstationId, workLocationId: null, assetId: null }
            : {}),
          ...(dto.workLocationId !== undefined
            ? { workLocationId: dto.workLocationId, assetId: null, workstationId: null }
            : {}),
          ...(dto.assetId !== undefined
            ? { assetId: dto.assetId, workLocationId: null, workstationId: null }
            : {}),
          ...(dto.parameter !== undefined ? { parameter: dto.parameter.trim() } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
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
        throw new ConflictException('This parameter already exists for the selected place or asset');
      }
      throw error;
    }
  }

  async remove(id: string, user: AuthenticatedUser, force = false) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const [referenced] = await this.db
      .select({ id: permitGasTesting.id })
      .from(permitGasTesting)
      .where(eq(permitGasTesting.gasTestingCatalogueId, id));
    if (referenced && !force) {
      throwInUse(['This gas testing item is used on a permit']);
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

  private oneTarget(dto: { workstationId?: string; workLocationId?: string; assetId?: string }) {
    const chosen = [dto.workstationId, dto.workLocationId, dto.assetId].filter(Boolean);
    if (chosen.length !== 1) {
      throw new BadRequestException('Set a work location, an asset, or a workstation');
    }
    if (dto.workLocationId) return 'location' as const;
    if (dto.assetId) return 'asset' as const;
    return 'workstation' as const;
  }

  private async locationIdFor(tenantId: string, id: string) {
    const [row] = await this.db
      .select({ id: workLocations.id })
      .from(workLocations)
      .where(and(eq(workLocations.id, id), eq(workLocations.tenantId, tenantId)));
    return row?.id ?? null;
  }

  private async assertLocation(tenantId: string, workLocationId: string) {
    const [row] = await this.db
      .select({ id: workLocations.id, status: workLocations.status })
      .from(workLocations)
      .where(and(eq(workLocations.id, workLocationId), eq(workLocations.tenantId, tenantId)));
    if (!row || row.status === 'archived') {
      throw new NotFoundException('Work location not found');
    }
  }

  private async assertAsset(tenantId: string, assetId: string) {
    const [row] = await this.db
      .select({ id: assets.id, status: assets.status })
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.tenantId, tenantId)));
    if (!row || row.status === 'archived') {
      throw new NotFoundException('Asset not found');
    }
  }

  /** A child location may add a test or tighten a limit. A wider limit is refused. */
  private async assertNotWiderThanAncestors(
    tenantId: string,
    workLocationId: string,
    parameter: string,
    minimum: number,
    maximum: number,
  ) {
    const ancestorIds: string[] = [];
    const seen = new Set<string>();
    let current: string | null = workLocationId;
    const [start] = await this.db
      .select({ parentId: workLocations.parentId })
      .from(workLocations)
      .where(and(eq(workLocations.id, current), eq(workLocations.tenantId, tenantId)));
    current = start?.parentId ?? null;
    while (current && !seen.has(current)) {
      seen.add(current);
      ancestorIds.push(current);
      const [parent] = await this.db
        .select({ parentId: workLocations.parentId })
        .from(workLocations)
        .where(and(eq(workLocations.id, current), eq(workLocations.tenantId, tenantId)));
      current = parent?.parentId ?? null;
    }
    if (ancestorIds.length === 0) return;
    const rows = await this.db
      .select({
        parameter: gasTestingCatalogue.parameter,
        minimum: gasTestingCatalogue.minimum,
        maximum: gasTestingCatalogue.maximum,
      })
      .from(gasTestingCatalogue)
      .where(
        and(
          eq(gasTestingCatalogue.tenantId, tenantId),
          eq(gasTestingCatalogue.isActive, true),
          or(
            inArray(gasTestingCatalogue.workLocationId, ancestorIds),
            inArray(gasTestingCatalogue.workstationId, ancestorIds),
          ),
        ),
      );
    const key = parameter.trim().toLowerCase();
    const baselines = rows.filter((row) => row.parameter.trim().toLowerCase() === key);
    if (widerThanAny({ minimum, maximum }, baselines)) {
      throw new UnprocessableEntityException(
        'A work location cannot store a wider gas test limit than a parent location',
      );
    }
  }

  private async assertSiteAccess(tenantId: string, siteId: string, user: AuthenticatedUser) {
    if (isTenantPrivileged(user.roles) || user.roles.includes('platform-admin')) return;
    const [member] = await this.db
      .select({ id: siteMembers.id })
      .from(siteMembers)
      .where(and(eq(siteMembers.tenantId, tenantId), eq(siteMembers.siteId, siteId), eq(siteMembers.userId, user.id)));
    if (!member) throw new NotFoundException('Work location not found');
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
