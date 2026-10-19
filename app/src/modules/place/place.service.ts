import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, count, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { throwInUse } from '../../common/http/in-use';
import { isTenantPrivileged, PERMIT_APPROVER_ROLE, userHasStoredRole } from '../../common/constants/tenant-roles';
import { requireTenant } from '../../common/helpers/tenant-context';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  assetTypes,
  assets,
  equipmentEnergySources,
  gasTestingCatalogue,
  incidentEquipment,
  isolationPoints,
  locationTypes,
  lototoPlans,
  lototoProcedures,
  permitAssets,
  permitLototo,
  permitLototoInstances,
  permits,
  siteMembers,
  sites,
  tenantUsers,
  workLocationApprovers,
  workLocations,
  assetHazards,
  hazardCategories,
  workLocationHazards,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  AddSiteMemberDto,
  CreateAssetDto,
  CreateNamedTypeDto,
  CreateSiteDto,
  CreateWorkLocationDto,
  PutApproversDto,
  UpdateAssetDto,
  UpdateNamedTypeDto,
  UpdateSiteDto,
  UpdateWorkLocationDto,
} from './dto/place.dto';
import { createsCycle, descendantIds, placePath, resolveApprovers } from './place-rules';

/** Permits in these states still use the place, so it cannot be archived. */
const OPEN_PERMIT_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'active',
  'execution_completed',
  'suspended',
  'pending_closure',
  'deferred',
] as const;

function seesAllSites(roles: readonly string[]): boolean {
  return isTenantPrivileged(roles) || roles.includes('platform-admin');
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i += 1) {
    if (typeof current === 'object' && current !== null && 'code' in current && (current as { code: unknown }).code === '23505') {
      return true;
    }
    current =
      typeof current === 'object' && current !== null && 'cause' in current
        ? (current as { cause: unknown }).cause
        : undefined;
  }
  return error instanceof Error && /unique/i.test(error.message);
}

@Injectable()
export class PlaceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async listSites(user: AuthenticatedUser, archived = false) {
    const tenantId = requireTenant(user);
    const status = archived ? eq(sites.status, 'archived') : ne(sites.status, 'archived');
    if (seesAllSites(user.roles)) {
      return this.db.select().from(sites).where(and(eq(sites.tenantId, tenantId), status));
    }
    const allowed = await this.memberSiteIds(tenantId, user.id);
    if (allowed.length === 0) return [];
    return this.db
      .select()
      .from(sites)
      .where(and(eq(sites.tenantId, tenantId), status, inArray(sites.id, allowed)));
  }

  async getSite(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertSiteAccess(tenantId, id, user);
    const [row] = await this.db
      .select()
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.tenantId, tenantId)));
    if (!row) throw new NotFoundException('Record not found');
    return row;
  }

  async createSite(dto: CreateSiteDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    try {
      const [row] = await this.db
        .insert(sites)
        .values({
          tenantId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          address: dto.address?.trim() || null,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      await this.audit('site.created', 'site', row.id, user, tenantId);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A site with this code already exists');
      throw error;
    }
  }

  async updateSite(id: string, dto: UpdateSiteDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    await this.assertSiteAccess(tenantId, id, user);
    try {
      const [row] = await this.db
        .update(sites)
        .set({
          ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.address !== undefined ? { address: dto.address.trim() || null } : {}),
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(and(eq(sites.id, id), eq(sites.tenantId, tenantId), ne(sites.status, 'archived')))
        .returning();
      if (!row) throw new NotFoundException('Record not found');
      if (dto.name !== undefined) await this.refreshPaths(id, tenantId);
      await this.audit('site.updated', 'site', id, user, tenantId);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A site with this code already exists');
      throw error;
    }
  }

  async archiveSite(id: string, user: AuthenticatedUser) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    await this.assertSiteAccess(tenantId, id, user);
    const locationIds = (
      await this.db
        .select({ id: workLocations.id })
        .from(workLocations)
        .where(and(eq(workLocations.tenantId, tenantId), eq(workLocations.siteId, id)))
    ).map((row) => row.id);
    const open = await this.countOpenPermits(
      locationIds.length
        ? and(eq(permits.tenantId, tenantId), inArray(permits.workLocationId, locationIds))
        : and(eq(permits.tenantId, tenantId), eq(permits.siteId, id)),
    );
    const openOnSite = await this.countOpenPermits(and(eq(permits.tenantId, tenantId), eq(permits.siteId, id)));
    if (open + openOnSite > 0) {
      throw new ConflictException('This site is on an open permit. Archive it after those permits are closed.');
    }
    const [row] = await this.db
      .update(sites)
      .set({ status: 'archived', updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(sites.id, id), eq(sites.tenantId, tenantId), ne(sites.status, 'archived')))
      .returning();
    if (!row) throw new NotFoundException('Record not found');
    await this.audit('site.archived', 'site', id, user, tenantId);
    return row;
  }

  async listMembers(siteId: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertSiteAccess(tenantId, siteId, user);
    return this.db
      .select()
      .from(siteMembers)
      .where(and(eq(siteMembers.tenantId, tenantId), eq(siteMembers.siteId, siteId)));
  }

  async addMember(siteId: string, dto: AddSiteMemberDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    await this.assertSiteAccess(tenantId, siteId, user);
    await this.requireTenantUser(tenantId, dto.userId);
    try {
      const [row] = await this.db
        .insert(siteMembers)
        .values({ tenantId, siteId, userId: dto.userId, createdBy: user.id, updatedBy: user.id })
        .returning();
      await this.audit('site_member.added', 'site', siteId, user, tenantId);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('This person already has access to the site');
      throw error;
    }
  }

  async removeMember(siteId: string, memberUserId: string, user: AuthenticatedUser, confirm: boolean) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    await this.assertSiteAccess(tenantId, siteId, user);
    const locations = await this.locationsOfSite(tenantId, siteId);
    const parentOf = new Map(locations.map((row) => [row.id, row.parentId]));
    const approverRows = locations.length
      ? await this.db
          .select()
          .from(workLocationApprovers)
          .where(
            and(
              eq(workLocationApprovers.tenantId, tenantId),
              inArray(
                workLocationApprovers.workLocationId,
                locations.map((row) => row.id),
              ),
            ),
          )
      : [];
    const approversOf = new Map<string, string[]>();
    for (const row of approverRows) {
      if (row.userId === memberUserId) continue;
      const list = approversOf.get(row.workLocationId) ?? [];
      list.push(row.userId);
      approversOf.set(row.workLocationId, list);
    }
    const bare = locations
      .filter((row) => approverRows.some((approver) => approver.workLocationId === row.id && approver.userId === memberUserId))
      .filter((row) => resolveApprovers(row.id, parentOf, approversOf).userIds.length === 0)
      .map((row) => row.name);
    if (bare.length > 0 && !confirm) {
      throw new ConflictException({
        message: 'Removing this person leaves a work location with no approver. Confirm to continue.',
        code: 'NO_APPROVER',
        locations: bare,
      });
    }
    const removed = await this.db
      .delete(siteMembers)
      .where(and(eq(siteMembers.tenantId, tenantId), eq(siteMembers.siteId, siteId), eq(siteMembers.userId, memberUserId)))
      .returning();
    if (removed.length === 0) throw new NotFoundException('Record not found');
    if (locations.length > 0) {
      await this.db
        .delete(workLocationApprovers)
        .where(
          and(
            eq(workLocationApprovers.tenantId, tenantId),
            eq(workLocationApprovers.userId, memberUserId),
            inArray(
              workLocationApprovers.workLocationId,
              locations.map((row) => row.id),
            ),
          ),
        );
    }
    await this.audit('site_member.removed', 'site', siteId, user, tenantId);
    return { removed: true };
  }

  async listLocationTypes(user: AuthenticatedUser, archived = false) {
    const tenantId = requireTenant(user);
    const status = archived ? eq(locationTypes.status, 'archived') : ne(locationTypes.status, 'archived');
    return this.db.select().from(locationTypes).where(and(eq(locationTypes.tenantId, tenantId), status));
  }

  async createLocationType(dto: CreateNamedTypeDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    this.assertTypeName(dto.name);
    const tenantId = requireTenant(user);
    try {
      const [row] = await this.db
        .insert(locationTypes)
        .values({
          tenantId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      await this.audit('location_type.created', 'location_type', row.id, user, tenantId);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('This location type already exists');
      throw error;
    }
  }

  async updateLocationType(id: string, dto: UpdateNamedTypeDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    if (dto.name !== undefined) this.assertTypeName(dto.name);
    const tenantId = requireTenant(user);
    try {
      const [row] = await this.db
        .update(locationTypes)
        .set({
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(and(eq(locationTypes.id, id), eq(locationTypes.tenantId, tenantId)))
        .returning();
      if (!row) throw new NotFoundException('Record not found');
      await this.audit('location_type.updated', 'location_type', id, user, tenantId);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('This location type already exists');
      throw error;
    }
  }

  async deleteLocationType(id: string, user: AuthenticatedUser, force = false) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    const [current] = await this.db
      .select()
      .from(locationTypes)
      .where(and(eq(locationTypes.id, id), eq(locationTypes.tenantId, tenantId)));
    if (!current) throw new NotFoundException('Record not found');
    if (!force) {
      const used = await this.db
        .select({ name: workLocations.name })
        .from(workLocations)
        .where(and(eq(workLocations.tenantId, tenantId), eq(workLocations.locationTypeId, id)))
        .limit(8);
      if (used.length > 0) {
        throwInUse(used.map((row) => `${row.name} uses this location type`));
      }
    }
    await this.db.delete(locationTypes).where(and(eq(locationTypes.id, id), eq(locationTypes.tenantId, tenantId)));
    await this.audit('location_type.deleted', 'location_type', id, user, tenantId);
    return { deleted: true };
  }

  async listWorkLocations(user: AuthenticatedUser, siteId: string, archived = false) {
    const tenantId = requireTenant(user);
    await this.assertSiteAccess(tenantId, siteId, user);
    const status = archived ? eq(workLocations.status, 'archived') : ne(workLocations.status, 'archived');
    const rows = await this.db
      .select()
      .from(workLocations)
      .where(and(eq(workLocations.tenantId, tenantId), eq(workLocations.siteId, siteId), status));
    const hazards = await this.locationHazardMap(rows.map((row) => row.id));
    return rows.map((row) => ({ ...row, hazardIds: hazards.get(row.id) ?? [] }));
  }

  async getWorkLocation(id: string, user: AuthenticatedUser) {
    const row = await this.requireLocation(id, user);
    const resolved = await this.resolvedApprovers(row.tenantId, row.id);
    const own = await this.db
      .select({ userId: workLocationApprovers.userId })
      .from(workLocationApprovers)
      .where(eq(workLocationApprovers.workLocationId, row.id));
    const hazards = await this.locationHazardMap([row.id]);
    return {
      ...row,
      approvers: resolved,
      ownApproverIds: own.map((item) => item.userId),
      hazardIds: hazards.get(row.id) ?? [],
    };
  }

  async createWorkLocation(dto: CreateWorkLocationDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    await this.assertSiteAccess(tenantId, dto.siteId, user);
    await this.assertParent(tenantId, dto.siteId, null, dto.parentId ?? null);
    if (dto.locationTypeId) await this.requireActiveType(locationTypes, dto.locationTypeId, tenantId);
    try {
      const [row] = await this.db
        .insert(workLocations)
        .values({
          tenantId,
          siteId: dto.siteId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          locationTypeId: dto.locationTypeId ?? null,
          parentId: dto.parentId ?? null,
          description: dto.description?.trim() || null,
          address: dto.address?.trim() || null,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      await this.refreshPaths(dto.siteId, tenantId);
      await this.replaceLocationHazards(row.id, tenantId, dto.hazardIds ?? [], user.id);
      await this.audit('work_location.created', 'work_location', row.id, user, tenantId);
      return this.getWorkLocation(row.id, user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A work location with this code already exists in this site');
      }
      throw error;
    }
  }

  async updateWorkLocation(id: string, dto: UpdateWorkLocationDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const current = await this.requireLocation(id, user);
    const parentId = dto.parentId === undefined ? current.parentId : dto.parentId;
    await this.assertParent(current.tenantId, current.siteId, id, parentId);
    if (dto.locationTypeId) await this.requireActiveType(locationTypes, dto.locationTypeId, current.tenantId);
    try {
      const [row] = await this.db
        .update(workLocations)
        .set({
          ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.locationTypeId !== undefined ? { locationTypeId: dto.locationTypeId } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.address !== undefined ? { address: dto.address.trim() || null } : {}),
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(and(eq(workLocations.id, id), eq(workLocations.tenantId, current.tenantId), ne(workLocations.status, 'archived')))
        .returning();
      if (!row) throw new NotFoundException('Record not found');
      if (dto.name !== undefined || dto.parentId !== undefined) {
        await this.refreshPaths(current.siteId, current.tenantId);
      }
      if (dto.hazardIds !== undefined) {
        await this.replaceLocationHazards(id, current.tenantId, dto.hazardIds, user.id);
      }
      await this.audit('work_location.updated', 'work_location', id, user, current.tenantId);
      return this.getWorkLocation(id, user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A work location with this code already exists in this site');
      }
      throw error;
    }
  }

  async archiveWorkLocation(id: string, user: AuthenticatedUser) {
    this.assertWriter(user);
    const current = await this.requireLocation(id, user);
    const locations = await this.locationsOfSite(current.tenantId, current.siteId);
    const parentOf = new Map(locations.map((row) => [row.id, row.parentId]));
    const ids = [id, ...descendantIds(id, parentOf)];
    const open = await this.countOpenPermits(
      and(eq(permits.tenantId, current.tenantId), inArray(permits.workLocationId, ids)),
    );
    if (open > 0) {
      throw new ConflictException('This work location is on an open permit. Archive it after those permits are closed.');
    }
    const [row] = await this.db
      .update(workLocations)
      .set({ status: 'archived', updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(workLocations.id, id), eq(workLocations.tenantId, current.tenantId), ne(workLocations.status, 'archived')))
      .returning();
    if (!row) throw new NotFoundException('Record not found');
    await this.audit('work_location.archived', 'work_location', id, user, current.tenantId);
    return row;
  }

  async resolvedApprovers(tenantId: string, locationId: string) {
    const [location] = await this.db
      .select()
      .from(workLocations)
      .where(and(eq(workLocations.id, locationId), eq(workLocations.tenantId, tenantId)));
    if (!location) throw new NotFoundException('Record not found');
    const locations = await this.locationsOfSite(tenantId, location.siteId);
    const parentOf = new Map(locations.map((row) => [row.id, row.parentId]));
    const rows = await this.db
      .select()
      .from(workLocationApprovers)
      .where(
        and(
          eq(workLocationApprovers.tenantId, tenantId),
          inArray(
            workLocationApprovers.workLocationId,
            locations.map((row) => row.id),
          ),
        ),
      );
    const approversOf = new Map<string, string[]>();
    for (const row of rows) {
      const list = approversOf.get(row.workLocationId) ?? [];
      list.push(row.userId);
      approversOf.set(row.workLocationId, list);
    }
    const resolved = resolveApprovers(locationId, parentOf, approversOf);
    return { ...resolved, warning: resolved.userIds.length === 0 };
  }

  async putApprovers(id: string, dto: PutApproversDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const location = await this.requireLocation(id, user);
    const userIds = [...new Set(dto.userIds)];
    for (const userId of userIds) {
      await this.assertApproverCandidate(location.tenantId, location.siteId, userId);
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(workLocationApprovers).where(eq(workLocationApprovers.workLocationId, id));
      if (userIds.length > 0) {
        await tx.insert(workLocationApprovers).values(
          userIds.map((userId) => ({
            tenantId: location.tenantId,
            workLocationId: id,
            userId,
            createdBy: user.id,
            updatedBy: user.id,
          })),
        );
      }
    });
    await this.audit('work_location.approvers_set', 'work_location', id, user, location.tenantId);
    return this.resolvedApprovers(location.tenantId, id);
  }

  async listAssetTypes(user: AuthenticatedUser, archived = false) {
    const tenantId = requireTenant(user);
    const status = archived ? eq(assetTypes.status, 'archived') : ne(assetTypes.status, 'archived');
    return this.db.select().from(assetTypes).where(and(eq(assetTypes.tenantId, tenantId), status));
  }

  async createAssetType(dto: CreateNamedTypeDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    try {
      const [row] = await this.db
        .insert(assetTypes)
        .values({
          tenantId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      await this.audit('asset_type.created', 'asset_type', row.id, user, tenantId);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('This asset type already exists');
      throw error;
    }
  }

  async updateAssetType(id: string, dto: UpdateNamedTypeDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    try {
      const [row] = await this.db
        .update(assetTypes)
        .set({
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(and(eq(assetTypes.id, id), eq(assetTypes.tenantId, tenantId)))
        .returning();
      if (!row) throw new NotFoundException('Record not found');
      await this.audit('asset_type.updated', 'asset_type', id, user, tenantId);
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('This asset type already exists');
      throw error;
    }
  }

  async deleteAssetType(id: string, user: AuthenticatedUser, force = false) {
    this.assertWriter(user);
    const tenantId = requireTenant(user);
    const [current] = await this.db
      .select()
      .from(assetTypes)
      .where(and(eq(assetTypes.id, id), eq(assetTypes.tenantId, tenantId)));
    if (!current) throw new NotFoundException('Record not found');
    if (!force) {
      const used = await this.db
        .select({ name: assets.name })
        .from(assets)
        .where(and(eq(assets.tenantId, tenantId), eq(assets.assetTypeId, id)))
        .limit(8);
      if (used.length > 0) {
        throwInUse(used.map((row) => `${row.name} uses this asset type`));
      }
    }
    await this.db.delete(assetTypes).where(and(eq(assetTypes.id, id), eq(assetTypes.tenantId, tenantId)));
    await this.audit('asset_type.deleted', 'asset_type', id, user, tenantId);
    return { deleted: true };
  }

  async listAssets(user: AuthenticatedUser, query: { siteId?: string; workLocationId?: string; exact?: boolean; archived?: boolean }) {
    const tenantId = requireTenant(user);
    if (!query.siteId && !query.workLocationId) {
      throw new BadRequestException('siteId or workLocationId is required');
    }
    let siteId = query.siteId;
    let locationIds: string[] | null = null;
    if (query.workLocationId) {
      const location = await this.requireLocation(query.workLocationId, user);
      if (siteId && siteId !== location.siteId) {
        throw new BadRequestException('workLocationId is not in that site');
      }
      siteId = location.siteId;
      if (query.exact) {
        locationIds = [location.id];
      } else {
        const locations = await this.locationsOfSite(tenantId, location.siteId);
        const parentOf = new Map(locations.map((row) => [row.id, row.parentId]));
        locationIds = [location.id, ...descendantIds(location.id, parentOf)];
      }
    }
    if (!siteId) throw new BadRequestException('siteId or workLocationId is required');
    await this.assertSiteAccess(tenantId, siteId, user);
    const status = query.archived ? eq(assets.status, 'archived') : ne(assets.status, 'archived');
    const where = [eq(assets.tenantId, tenantId), eq(assets.siteId, siteId), status];
    if (locationIds) where.push(inArray(assets.workLocationId, locationIds));
    const rows = await this.db.select().from(assets).where(and(...where));
    const hazards = await this.assetHazardMap(rows.map((row) => row.id));
    return rows.map((row) => ({ ...row, hazardIds: hazards.get(row.id) ?? [] }));
  }

  async getAsset(id: string, user: AuthenticatedUser) {
    const row = await this.requireAsset(id, user);
    const hazards = await this.assetHazardMap([row.id]);
    return { ...row, hazardIds: hazards.get(row.id) ?? [] };
  }

  async createAsset(dto: CreateAssetDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const location = await this.requireLocation(dto.workLocationId, user);
    if (dto.assetTypeId) await this.requireActiveType(assetTypes, dto.assetTypeId, location.tenantId);
    if (dto.parentAssetId) await this.assertAssetParent(location.tenantId, location.siteId, null, dto.parentAssetId);
    try {
      const [row] = await this.db
        .insert(assets)
        .values({
          tenantId: location.tenantId,
          siteId: location.siteId,
          workLocationId: location.id,
          tag: dto.tag.trim(),
          assetNumber: dto.assetNumber?.trim() || null,
          name: dto.name.trim(),
          assetTypeId: dto.assetTypeId ?? null,
          parentAssetId: dto.parentAssetId ?? null,
          description: dto.description?.trim() || null,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();
      await this.replaceAssetHazards(row.id, location.tenantId, dto.hazardIds ?? [], user.id);
      await this.audit('asset.created', 'asset', row.id, user, location.tenantId);
      return { ...row, hazardIds: dto.hazardIds ?? [] };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('This tag or asset number is already used');
      throw error;
    }
  }

  async updateAsset(id: string, dto: UpdateAssetDto, user: AuthenticatedUser) {
    this.assertWriter(user);
    const current = await this.requireAsset(id, user);
    const location = dto.workLocationId
      ? await this.requireLocation(dto.workLocationId, user)
      : await this.requireLocation(current.workLocationId, user);
    if (location.tenantId !== current.tenantId) throw new NotFoundException('Record not found');
    if (dto.assetTypeId) await this.requireActiveType(assetTypes, dto.assetTypeId, current.tenantId);
    const parentId = dto.parentAssetId === undefined ? current.parentAssetId : dto.parentAssetId;
    if (parentId) await this.assertAssetParent(current.tenantId, location.siteId, id, parentId);
    try {
      const [row] = await this.db
        .update(assets)
        .set({
          ...(dto.tag !== undefined ? { tag: dto.tag.trim() } : {}),
          ...(dto.assetNumber !== undefined ? { assetNumber: dto.assetNumber?.trim() || null } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.workLocationId !== undefined ? { workLocationId: location.id, siteId: location.siteId } : {}),
          ...(dto.assetTypeId !== undefined ? { assetTypeId: dto.assetTypeId } : {}),
          ...(dto.parentAssetId !== undefined ? { parentAssetId: dto.parentAssetId } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(and(eq(assets.id, id), eq(assets.tenantId, current.tenantId), ne(assets.status, 'archived')))
        .returning();
      if (!row) throw new NotFoundException('Record not found');
      if (dto.hazardIds !== undefined) {
        await this.replaceAssetHazards(id, current.tenantId, dto.hazardIds, user.id);
      }
      await this.audit('asset.updated', 'asset', id, user, current.tenantId);
      const hazards = await this.assetHazardMap([row.id]);
      return { ...row, hazardIds: hazards.get(row.id) ?? [] };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('This tag or asset number is already used');
      throw error;
    }
  }

  async archiveAsset(id: string, user: AuthenticatedUser) {
    this.assertWriter(user);
    const current = await this.requireAsset(id, user);
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(permitAssets)
      .innerJoin(permits, eq(permits.id, permitAssets.permitId))
      .where(and(eq(permitAssets.assetId, id), inArray(permits.status, [...OPEN_PERMIT_STATUSES])));
    if (Number(n) > 0) {
      throw new ConflictException('This asset is on an open permit. Archive it after those permits are closed.');
    }
    const [row] = await this.db
      .update(assets)
      .set({ status: 'archived', updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(assets.id, id), eq(assets.tenantId, current.tenantId), ne(assets.status, 'archived')))
      .returning();
    if (!row) throw new NotFoundException('Record not found');
    await this.audit('asset.archived', 'asset', id, user, current.tenantId);
    return row;
  }

  async deleteAsset(id: string, user: AuthenticatedUser, confirm = false, deleteLototo = false) {
    this.assertWriter(user);
    const current = await this.requireAsset(id, user);
    const tenantId = current.tenantId;
    const uses = await this.assetUses(id);
    if (uses.length > 0 && !confirm) {
      throwInUse(uses);
    }
    await this.db.execute(sql`ALTER TABLE equipment_energy_sources DISABLE TRIGGER USER`);
    await this.db.execute(sql`ALTER TABLE isolation_points DISABLE TRIGGER USER`);
    try {
      await this.db.update(assets).set({ parentAssetId: null }).where(eq(assets.parentAssetId, id));
      await this.db.delete(permitAssets).where(eq(permitAssets.assetId, id));
      await this.db
        .delete(gasTestingCatalogue)
        .where(and(eq(gasTestingCatalogue.assetId, id), isNull(gasTestingCatalogue.workLocationId), isNull(gasTestingCatalogue.workstationId)));
      await this.db.update(gasTestingCatalogue).set({ assetId: null }).where(eq(gasTestingCatalogue.assetId, id));
      await this.db.delete(incidentEquipment).where(and(eq(incidentEquipment.assetId, id), isNull(incidentEquipment.machineryId)));
      await this.db.update(incidentEquipment).set({ assetId: null }).where(eq(incidentEquipment.assetId, id));
      if (deleteLototo) {
        await this.removeAssetLototo(id);
      } else {
        await this.db.update(lototoProcedures).set({ assetId: null }).where(eq(lototoProcedures.assetId, id));
        await this.db.update(lototoPlans).set({ assetId: null }).where(eq(lototoPlans.assetId, id));
        await this.db.update(equipmentEnergySources).set({ assetId: null }).where(eq(equipmentEnergySources.assetId, id));
        await this.db.update(isolationPoints).set({ assetId: null }).where(eq(isolationPoints.assetId, id));
      }
      const [row] = await this.db.delete(assets).where(and(eq(assets.id, id), eq(assets.tenantId, tenantId))).returning();
      if (!row) throw new NotFoundException('Record not found');
      await this.audit('asset.deleted', 'asset', id, user, tenantId);
      return { deleted: true };
    } finally {
      await this.db.execute(sql`ALTER TABLE equipment_energy_sources ENABLE TRIGGER USER`);
      await this.db.execute(sql`ALTER TABLE isolation_points ENABLE TRIGGER USER`);
    }
  }

  private async assetUses(id: string): Promise<string[]> {
    const lines: string[] = [];
    const [{ children }] = await this.db.select({ children: count() }).from(assets).where(eq(assets.parentAssetId, id));
    const [{ permitsUsing }] = await this.db.select({ permitsUsing: count() }).from(permitAssets).where(eq(permitAssets.assetId, id));
    const [{ incidentsUsing }] = await this.db.select({ incidentsUsing: count() }).from(incidentEquipment).where(eq(incidentEquipment.assetId, id));
    const [{ gasUsing }] = await this.db.select({ gasUsing: count() }).from(gasTestingCatalogue).where(eq(gasTestingCatalogue.assetId, id));
    const [{ procedures }] = await this.db.select({ procedures: count() }).from(lototoProcedures).where(eq(lototoProcedures.assetId, id));
    const [{ plans }] = await this.db.select({ plans: count() }).from(lototoPlans).where(eq(lototoPlans.assetId, id));
    if (Number(children) > 0) lines.push(`${children} child asset(s) are nested under it`);
    if (Number(permitsUsing) > 0) lines.push(`${permitsUsing} permit(s) list this asset`);
    if (Number(incidentsUsing) > 0) lines.push(`${incidentsUsing} incident(s) name this asset`);
    if (Number(gasUsing) > 0) lines.push(`${gasUsing} gas test(s) are set on this asset`);
    if (Number(procedures) > 0) lines.push(`${procedures} LOTOTO procedure(s) belong to this asset`);
    if (Number(plans) > 0) lines.push(`${plans} LOTOTO plan(s) belong to this asset`);
    return lines;
  }

  private async removeAssetLototo(id: string) {
    const procedures = await this.db.select({ id: lototoProcedures.id }).from(lototoProcedures).where(eq(lototoProcedures.assetId, id));
    const procedureIds = procedures.map((row) => row.id);
    if (procedureIds.length > 0) {
      await this.db.delete(permitLototoInstances).where(inArray(permitLototoInstances.procedureId, procedureIds));
      await this.db.update(lototoProcedures).set({ publishedVersionId: null }).where(inArray(lototoProcedures.id, procedureIds));
      await this.db.delete(lototoProcedures).where(inArray(lototoProcedures.id, procedureIds));
    }
    const plans = await this.db.select({ id: lototoPlans.id }).from(lototoPlans).where(eq(lototoPlans.assetId, id));
    const planIds = plans.map((row) => row.id);
    await this.db.delete(equipmentEnergySources).where(eq(equipmentEnergySources.assetId, id));
    await this.db.delete(isolationPoints).where(eq(isolationPoints.assetId, id));
    if (planIds.length > 0) {
      await this.db.delete(permitLototo).where(inArray(permitLototo.lototoPlanId, planIds));
      await this.db.delete(lototoPlans).where(inArray(lototoPlans.id, planIds));
    }
  }

  private assertWriter(user: AuthenticatedUser) {
    if (!seesAllSites(user.roles)) {
      throw new ForbiddenException('Only an owner or admin can change places');
    }
  }

  private assertTypeName(name: string) {
    if (name.trim().toLowerCase() === 'site') {
      throw new BadRequestException('Site is not a location type');
    }
  }

  private async memberSiteIds(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ siteId: siteMembers.siteId })
      .from(siteMembers)
      .where(and(eq(siteMembers.tenantId, tenantId), eq(siteMembers.userId, userId)));
    return rows.map((row) => row.siteId);
  }

  private async assertSiteAccess(tenantId: string, siteId: string, user: AuthenticatedUser) {
    const [site] = await this.db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)));
    if (!site) throw new NotFoundException('Record not found');
    if (seesAllSites(user.roles)) return;
    const allowed = await this.memberSiteIds(tenantId, user.id);
    if (!allowed.includes(siteId)) throw new NotFoundException('Record not found');
  }

  private async locationsOfSite(tenantId: string, siteId: string) {
    return this.db
      .select()
      .from(workLocations)
      .where(and(eq(workLocations.tenantId, tenantId), eq(workLocations.siteId, siteId)));
  }

  private async requireLocation(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .select()
      .from(workLocations)
      .where(and(eq(workLocations.id, id), eq(workLocations.tenantId, tenantId)));
    if (!row) throw new NotFoundException('Record not found');
    await this.assertSiteAccess(tenantId, row.siteId, user);
    return row;
  }

  private async requireAsset(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const [row] = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.tenantId, tenantId)));
    if (!row) throw new NotFoundException('Record not found');
    await this.assertSiteAccess(tenantId, row.siteId, user);
    return row;
  }

  private async assertParent(tenantId: string, siteId: string, locationId: string | null, parentId: string | null) {
    if (!parentId) return;
    if (parentId === locationId) {
      throw new UnprocessableEntityException('A work location cannot be inside itself');
    }
    const locations = await this.locationsOfSite(tenantId, siteId);
    const parent = locations.find((row) => row.id === parentId);
    if (!parent) throw new BadRequestException('Parent work location must be in the same site');
    const parentOf = new Map(locations.map((row) => [row.id, row.parentId]));
    if (locationId && createsCycle(locationId, parentId, parentOf)) {
      throw new UnprocessableEntityException('A work location cannot be placed under one of its own sub-locations');
    }
  }

  private async assertAssetParent(tenantId: string, siteId: string, assetId: string | null, parentId: string) {
    if (parentId === assetId) {
      throw new UnprocessableEntityException('An asset cannot be part of itself');
    }
    const rows = await this.db
      .select({ id: assets.id, parentAssetId: assets.parentAssetId, siteId: assets.siteId })
      .from(assets)
      .where(eq(assets.tenantId, tenantId));
    const parent = rows.find((row) => row.id === parentId);
    if (!parent || parent.siteId !== siteId) {
      throw new BadRequestException('Parent asset must be in the same site');
    }
    const parentOf = new Map(rows.map((row) => [row.id, row.parentAssetId]));
    if (assetId && createsCycle(assetId, parentId, parentOf)) {
      throw new UnprocessableEntityException('An asset cannot be placed under one of its own parts');
    }
  }

  private async requireActiveType(
    table: typeof locationTypes | typeof assetTypes,
    id: string,
    tenantId: string,
  ) {
    const [row] = await this.db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, id), eq(table.tenantId, tenantId), ne(table.status, 'archived')));
    if (!row) throw new BadRequestException('Type not found');
  }

  private async requireTenantUser(tenantId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.keycloakUserId, userId)));
    if (!row) throw new BadRequestException('User is not in this organisation');
    return row;
  }

  private async assertApproverCandidate(tenantId: string, siteId: string, userId: string) {
    const person = await this.requireTenantUser(tenantId, userId);
    if (!userHasStoredRole(person, PERMIT_APPROVER_ROLE)) {
      throw new BadRequestException('Approvers must hold the permit approver role');
    }
    if (isTenantPrivileged([person.role, ...(person.roles ?? [])])) return;
    const [member] = await this.db
      .select({ id: siteMembers.id })
      .from(siteMembers)
      .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)));
    if (!member) throw new BadRequestException('Approvers must have access to this site');
  }

  private async countOpenPermits(where: ReturnType<typeof and>) {
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(permits)
      .where(and(where, inArray(permits.status, [...OPEN_PERMIT_STATUSES])));
    return Number(n);
  }

  private async refreshPaths(siteId: string, tenantId: string) {
    const [site] = await this.db
      .select({ name: sites.name })
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)));
    if (!site) return;
    const rows = await this.locationsOfSite(tenantId, siteId);
    const nameOf = new Map(rows.map((row) => [row.id, row.name]));
    const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));
    for (const row of rows) {
      const pathText = placePath(row.id, site.name, nameOf, parentOf);
      if (pathText === row.pathText) continue;
      await this.db
        .update(workLocations)
        .set({ pathText, updatedAt: new Date() })
        .where(eq(workLocations.id, row.id));
    }
  }

  private async audit(action: string, entityType: string, entityId: string, user: AuthenticatedUser, tenantId: string) {
    await this.auditService.log({ action, entityType, entityId, userId: user.id, tenantId });
  }

  private async assertHazardIds(tenantId: string, hazardIds: string[]) {
    const unique = [...new Set(hazardIds)];
    if (unique.length === 0) return unique;
    const rows = await this.db
      .select({ id: hazardCategories.id })
      .from(hazardCategories)
      .where(and(eq(hazardCategories.tenantId, tenantId), inArray(hazardCategories.id, unique)));
    if (rows.length !== unique.length) {
      throw new BadRequestException('One or more hazards are not in this organisation');
    }
    return unique;
  }

  private async locationHazardMap(ids: string[]) {
    const map = new Map<string, string[]>();
    if (ids.length === 0) return map;
    const links = await this.db
      .select({
        workLocationId: workLocationHazards.workLocationId,
        hazardCategoryId: workLocationHazards.hazardCategoryId,
      })
      .from(workLocationHazards)
      .where(inArray(workLocationHazards.workLocationId, ids));
    for (const link of links) {
      const list = map.get(link.workLocationId) ?? [];
      list.push(link.hazardCategoryId);
      map.set(link.workLocationId, list);
    }
    return map;
  }

  private async assetHazardMap(ids: string[]) {
    const map = new Map<string, string[]>();
    if (ids.length === 0) return map;
    const links = await this.db
      .select({ assetId: assetHazards.assetId, hazardCategoryId: assetHazards.hazardCategoryId })
      .from(assetHazards)
      .where(inArray(assetHazards.assetId, ids));
    for (const link of links) {
      const list = map.get(link.assetId) ?? [];
      list.push(link.hazardCategoryId);
      map.set(link.assetId, list);
    }
    return map;
  }

  private async replaceLocationHazards(locationId: string, tenantId: string, hazardIds: string[], userId: string) {
    const unique = await this.assertHazardIds(tenantId, hazardIds);
    await this.db.delete(workLocationHazards).where(eq(workLocationHazards.workLocationId, locationId));
    if (unique.length === 0) return;
    await this.db.insert(workLocationHazards).values(
      unique.map((hazardCategoryId) => ({
        tenantId,
        workLocationId: locationId,
        hazardCategoryId,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }

  private async replaceAssetHazards(assetId: string, tenantId: string, hazardIds: string[], userId: string) {
    const unique = await this.assertHazardIds(tenantId, hazardIds);
    await this.db.delete(assetHazards).where(eq(assetHazards.assetId, assetId));
    if (unique.length === 0) return;
    await this.db.insert(assetHazards).values(
      unique.map((hazardCategoryId) => ({
        tenantId,
        assetId,
        hazardCategoryId,
        createdBy: userId,
        updatedBy: userId,
      })),
    );
  }
}
