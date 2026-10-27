import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  assetHazards,
  assets,
  hazardCatalogueRequests,
  hazardCategories,
  hazardPpe,
  permitHazards,
  permitTypes,
  permits,
  ppeCatalogue,
  tenantUsers,
  workLocationHazards,
  workLocations,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateHazardDto } from './dto/create-hazard.dto';
import { DecideHazardRequestDto } from './dto/decide-hazard-request.dto';
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
    @Optional() private readonly notificationsService?: NotificationsService,
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

  async listCatalogueRequests(user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const requests = await this.db
      .select()
      .from(hazardCatalogueRequests)
      .where(and(eq(hazardCatalogueRequests.tenantId, tenantId), eq(hazardCatalogueRequests.status, 'pending')))
      .orderBy(desc(hazardCatalogueRequests.createdAt));
    if (requests.length === 0) {
      return [];
    }

    const permitIds = [...new Set(requests.map((request) => request.permitId))];
    const locationIds = [...new Set(requests.map((request) => request.workLocationId).filter((id): id is string => Boolean(id)))];
    const assetIds = [...new Set(requests.flatMap((request) => request.assetIds ?? []))];
    const requesterIds = [...new Set(requests.map((request) => request.requestedBy))];

    const [permitRows, locationRows, assetRows, people] = await Promise.all([
      this.db
        .select({ id: permits.id, title: permits.title, reference: permits.reference })
        .from(permits)
        .where(and(eq(permits.tenantId, tenantId), inArray(permits.id, permitIds))),
      locationIds.length
        ? this.db
            .select({ id: workLocations.id, name: workLocations.name })
            .from(workLocations)
            .where(and(eq(workLocations.tenantId, tenantId), inArray(workLocations.id, locationIds)))
        : Promise.resolve([]),
      assetIds.length
        ? this.db
            .select({ id: assets.id, name: assets.name })
            .from(assets)
            .where(and(eq(assets.tenantId, tenantId), inArray(assets.id, assetIds)))
        : Promise.resolve([]),
      this.db
        .select({
          keycloakUserId: tenantUsers.keycloakUserId,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          email: tenantUsers.email,
        })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), inArray(tenantUsers.keycloakUserId, requesterIds))),
    ]);

    const permitById = new Map(permitRows.map((row) => [row.id, row]));
    const locationById = new Map(locationRows.map((row) => [row.id, row.name]));
    const assetById = new Map(assetRows.map((row) => [row.id, row.name]));
    const personById = new Map(
      people.map((person) => [
        person.keycloakUserId,
        [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email,
      ]),
    );

    return requests.map((request) => ({
      id: request.id,
      permitId: request.permitId,
      permitTitle: permitById.get(request.permitId)?.title ?? 'Permit',
      permitReference: permitById.get(request.permitId)?.reference ?? null,
      name: request.name,
      description: request.description,
      risks: request.risks ?? [],
      consequences: request.consequences ?? [],
      controls: request.controls ?? [],
      permitTypeCode: request.permitTypeCode,
      siteId: request.siteId,
      workLocationId: request.workLocationId,
      workLocationName: request.workLocationId ? locationById.get(request.workLocationId) ?? null : null,
      assets: (request.assetIds ?? []).map((id) => ({ id, name: assetById.get(id) ?? 'Asset' })),
      requestedByName: personById.get(request.requestedBy) ?? null,
      createdAt: request.createdAt.toISOString(),
    }));
  }

  async approveCatalogueRequest(id: string, dto: DecideHazardRequestDto, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const request = await this.requirePendingRequest(id, tenantId);
    const risks = trimLines(dto.risks);
    const controls = trimLines(dto.controls);
    const consequences = trimLines(dto.consequences);
    const permitTypeCodes = [...new Set(dto.permitTypeCodes.map((code) => code.trim()).filter(Boolean))];
    if (!dto.name.trim() || risks.length === 0 || controls.length === 0) {
      throw new BadRequestException('Name, one risk and one control are required');
    }
    if (permitTypeCodes.length === 0) {
      throw new BadRequestException('Choose at least one permit type');
    }

    const types = await this.db
      .select({ code: permitTypes.code })
      .from(permitTypes)
      .where(and(eq(permitTypes.tenantId, tenantId), inArray(permitTypes.code, permitTypeCodes)));
    if (types.length !== permitTypeCodes.length) {
      throw new BadRequestException('A permit type is not in this organisation');
    }

    const workLocationIds = [...new Set(dto.workLocationIds)];
    const assetIds = [...new Set(dto.assetIds)];
    if (workLocationIds.length > 0) {
      const locations = await this.db
        .select({ id: workLocations.id })
        .from(workLocations)
        .where(and(eq(workLocations.tenantId, tenantId), inArray(workLocations.id, workLocationIds)));
      if (locations.length !== workLocationIds.length) {
        throw new BadRequestException('A work location is not in this organisation');
      }
    }
    if (assetIds.length > 0) {
      const found = await this.db
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.tenantId, tenantId), inArray(assets.id, assetIds)));
      if (found.length !== assetIds.length) {
        throw new BadRequestException('An asset is not in this organisation');
      }
    }

    const slug = dto.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'hazard';
    const created = await this.create(
      {
        name: dto.name.trim(),
        code: `${slug}-${randomUUID().slice(0, 8)}`,
        category: 'Custom',
        description: dto.description?.trim() || undefined,
        severity: 'medium',
        consequences,
        risks,
        controls,
        permitTypeCodes,
      },
      user,
    );

    if (workLocationIds.length > 0) {
      await this.db.insert(workLocationHazards).values(
        workLocationIds.map((workLocationId) => ({
          tenantId,
          workLocationId,
          hazardCategoryId: created.id,
          createdBy: user.id,
          updatedBy: user.id,
        })),
      );
    }
    if (assetIds.length > 0) {
      await this.db.insert(assetHazards).values(
        assetIds.map((assetId) => ({
          tenantId,
          assetId,
          hazardCategoryId: created.id,
          createdBy: user.id,
          updatedBy: user.id,
        })),
      );
    }

    const now = new Date();
    await this.db
      .update(hazardCatalogueRequests)
      .set({
        status: 'approved',
        hazardCategoryId: created.id,
        decidedBy: user.id,
        decidedAt: now,
        updatedAt: now,
        updatedBy: user.id,
      })
      .where(eq(hazardCatalogueRequests.id, request.id));
    await this.db
      .update(permitHazards)
      .set({ catalogueRequest: 'approved', updatedAt: now, updatedBy: user.id })
      .where(and(eq(permitHazards.permitId, request.permitId), eq(permitHazards.customKey, request.customKey)));

    await this.notifyRequester(
      tenantId,
      user.id,
      request.requestedBy,
      request.permitId,
      `Hazard added: ${dto.name.trim()}`,
      `"${dto.name.trim()}" is now on the organisation hazard list. This permit keeps the wording that was written.`,
      `${tenantId}:hazard-request:${request.id}:approved`,
    );
    return { id: request.id, hazardCategoryId: created.id, status: 'approved' as const };
  }

  async rejectCatalogueRequest(id: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const request = await this.requirePendingRequest(id, tenantId);
    const now = new Date();
    await this.db
      .update(hazardCatalogueRequests)
      .set({ status: 'rejected', decidedBy: user.id, decidedAt: now, updatedAt: now, updatedBy: user.id })
      .where(eq(hazardCatalogueRequests.id, request.id));
    await this.db
      .update(permitHazards)
      .set({ catalogueRequest: 'rejected', updatedAt: now, updatedBy: user.id })
      .where(and(eq(permitHazards.permitId, request.permitId), eq(permitHazards.customKey, request.customKey)));
    await this.notifyRequester(
      tenantId,
      user.id,
      request.requestedBy,
      request.permitId,
      `Hazard stays on this permit: ${request.name}`,
      `"${request.name}" was not added to the organisation hazard list. It stays on this permit only.`,
      `${tenantId}:hazard-request:${request.id}:rejected`,
    );
    return { id: request.id, status: 'rejected' as const };
  }

  private async requirePendingRequest(id: string, tenantId: string) {
    const [request] = await this.db
      .select()
      .from(hazardCatalogueRequests)
      .where(and(eq(hazardCatalogueRequests.id, id), eq(hazardCatalogueRequests.tenantId, tenantId)));
    if (!request) {
      throw new NotFoundException('Hazard request not found');
    }
    if (request.status !== 'pending') {
      throw new ConflictException('This hazard request has already been decided');
    }
    return request;
  }

  private async notifyRequester(
    tenantId: string,
    actorId: string,
    requestedBy: string,
    permitId: string,
    title: string,
    body: string,
    dedupeKey: string,
  ) {
    if (!this.notificationsService || requestedBy === actorId) {
      return;
    }
    try {
      await this.notificationsService.generateSystem(tenantId, actorId, {
        eventType: 'task_reminder',
        category: 'workflow',
        title,
        body,
        recipientUserIds: [requestedBy],
        entityType: 'permit',
        entityId: permitId,
        dedupeKey,
        sourceModule: 'master-data',
      });
    } catch {
      // The decision is already saved. A missed notice must not undo it.
    }
  }
}
