import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  permitTypes,
  safetyChecklistItems,
  safetyChecklists,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { MasterDataCacheService } from './master-data-cache.service';
import { MasterDataLogService } from './master-data-log.service';
import { ReferenceIntegrityService } from './reference-integrity.service';

@Injectable()
export class ChecklistService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cacheService: MasterDataCacheService,
    private readonly auditService: AuditService,
    private readonly logService: MasterDataLogService,
    private readonly referenceIntegrity: ReferenceIntegrityService,
  ) {}

  async create(dto: CreateChecklistDto, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);

    if (dto.items.length === 0) {
      throw new BadRequestException('Checklist must contain at least one item');
    }

    if (dto.permitTypeId) {
      await this.assertPermitTypeExists(tenantId, dto.permitTypeId);
    }

    const status = dto.publish ? 'published' : 'draft';

    try {
      const result = await this.db.transaction(async (tx) => {
        const [checklist] = await tx
          .insert(safetyChecklists)
          .values({
            tenantId,
            code: dto.code.trim(),
            name: dto.name.trim(),
            description: dto.description,
            permitTypeId: dto.permitTypeId ?? null,
            status,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning();

        const items = await tx
          .insert(safetyChecklistItems)
          .values(
            dto.items.map((item, index) => ({
              checklistId: checklist.id,
              sequence: index + 1,
              description: item.description.trim(),
              isMandatory: item.isMandatory ?? false,
              createdBy: user.id,
            })),
          )
          .returning();

        return { checklist, items };
      });

      await this.afterMutation(tenantId, user, 'checklist.created', result.checklist.id);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException(`Checklist code '${dto.code}' already exists`);
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const cached = await this.cacheService.get<
      Array<{
        checklist: typeof safetyChecklists.$inferSelect;
        items: (typeof safetyChecklistItems.$inferSelect)[];
      }>
    >(tenantId, 'checklists');
    if (cached) {
      return cached;
    }

    const checklists = await this.db
      .select()
      .from(safetyChecklists)
      .where(eq(safetyChecklists.tenantId, tenantId));

    const results = await Promise.all(
      checklists.map(async (checklist) => {
        const items = await this.db
          .select()
          .from(safetyChecklistItems)
          .where(eq(safetyChecklistItems.checklistId, checklist.id))
          .orderBy(asc(safetyChecklistItems.sequence));
        return { checklist, items };
      }),
    );

    await this.cacheService.set(tenantId, 'checklists', results);
    return results;
  }

  async listSummaries(user: AuthenticatedUser) {
    const results = await this.findAll(user);
    return results.map(({ checklist }) => checklist);
  }

  async update(id: string, dto: Partial<CreateChecklistDto>, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const [row] = await this.db
      .update(safetyChecklists)
      .set({
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(safetyChecklists.id, id), eq(safetyChecklists.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new NotFoundException('Checklist not found');
    }

    await this.afterMutation(tenantId, user, 'checklist.updated', id);
    return row;
  }

  async archive(id: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const [row] = await this.db
      .update(safetyChecklists)
      .set({ status: 'archived', updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(safetyChecklists.id, id), eq(safetyChecklists.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new NotFoundException('Checklist not found');
    }

    await this.afterMutation(tenantId, user, 'checklist.archived', id);
    return row;
  }

  async publish(id: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);

    const [checklist] = await this.db
      .select()
      .from(safetyChecklists)
      .where(and(eq(safetyChecklists.id, id), eq(safetyChecklists.tenantId, tenantId)));

    if (!checklist) {
      throw new NotFoundException('Checklist not found');
    }

    const items = await this.db
      .select()
      .from(safetyChecklistItems)
      .where(eq(safetyChecklistItems.checklistId, id));

    if (items.length === 0) {
      throw new BadRequestException('Cannot publish an empty checklist');
    }

    const [updated] = await this.db
      .update(safetyChecklists)
      .set({ status: 'published', updatedBy: user.id })
      .where(eq(safetyChecklists.id, id))
      .returning();

    await this.afterMutation(tenantId, user, 'checklist.published', id);
    return { checklist: updated, items };
  }

  private async assertPermitTypeExists(tenantId: string, permitTypeId: string) {
    const [row] = await this.db
      .select()
      .from(permitTypes)
      .where(and(eq(permitTypes.id, permitTypeId), eq(permitTypes.tenantId, tenantId)));

    if (!row) {
      throw new NotFoundException('Permit type not found for this tenant');
    }
  }

  private async afterMutation(
    tenantId: string,
    user: AuthenticatedUser,
    action: string,
    entityId: string,
  ) {
    await this.cacheService.invalidate(tenantId, 'checklists');
    await this.auditService.log({
      action,
      entityType: 'safety_checklist',
      entityId,
      userId: user.id,
      tenantId,
    });
    this.logService.logEvent({
      action,
      tenantId,
      userId: user.id,
      entityType: 'safety_checklist',
      entityId,
    });
  }
}
