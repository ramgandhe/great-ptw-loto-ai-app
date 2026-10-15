import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { throwInUse } from '../../common/http/in-use';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { ppeCatalogue, ppeCategories } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CreatePpeDto } from './dto/create-ppe.dto';
import { MasterDataCacheService } from './master-data-cache.service';
import { MasterDataLogService } from './master-data-log.service';
import { ReferenceIntegrityService } from './reference-integrity.service';

@Injectable()
export class PpeService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cacheService: MasterDataCacheService,
    private readonly auditService: AuditService,
    private readonly logService: MasterDataLogService,
    private readonly referenceIntegrity: ReferenceIntegrityService,
  ) {}

  async listCategories(user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    return this.db
      .select()
      .from(ppeCategories)
      .where(and(eq(ppeCategories.tenantId, tenantId), ne(ppeCategories.status, 'archived')));
  }

  async createCategory(name: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictException('Category name is required');
    try {
      const [row] = await this.db
        .insert(ppeCategories)
        .values({ tenantId, name: trimmed, createdBy: user.id, updatedBy: user.id })
        .returning();
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('This category already exists');
      }
      throw error;
    }
  }

  async updateCategory(id: string, name: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const trimmed = name.trim();
    if (!trimmed) throw new ConflictException('Category name is required');
    const [current] = await this.db
      .select()
      .from(ppeCategories)
      .where(and(eq(ppeCategories.id, id), eq(ppeCategories.tenantId, tenantId)));
    if (!current) throw new NotFoundException('Category not found');
    try {
      const [row] = await this.db
        .update(ppeCategories)
        .set({ name: trimmed, updatedBy: user.id, updatedAt: new Date() })
        .where(and(eq(ppeCategories.id, id), eq(ppeCategories.tenantId, tenantId)))
        .returning();
      if (current.name !== trimmed) {
        await this.db
          .update(ppeCatalogue)
          .set({ category: trimmed, updatedAt: new Date() })
          .where(and(eq(ppeCatalogue.tenantId, tenantId), eq(ppeCatalogue.category, current.name)));
      }
      await this.cacheService.invalidate(tenantId, 'ppe');
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException('This category already exists');
      }
      throw error;
    }
  }

  async deleteCategory(id: string, user: AuthenticatedUser, force = false) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const [current] = await this.db
      .select()
      .from(ppeCategories)
      .where(and(eq(ppeCategories.id, id), eq(ppeCategories.tenantId, tenantId)));
    if (!current) throw new NotFoundException('Category not found');
    const used = await this.db
      .select({ name: ppeCatalogue.name })
      .from(ppeCatalogue)
      .where(and(eq(ppeCatalogue.tenantId, tenantId), eq(ppeCatalogue.category, current.name)))
      .limit(8);
    if (used.length > 0 && !force) {
      throwInUse(used.map((row) => `${row.name} uses this category`));
    }
    if (force) {
      await this.db
        .update(ppeCatalogue)
        .set({ category: 'Uncategorised', updatedAt: new Date() })
        .where(and(eq(ppeCatalogue.tenantId, tenantId), eq(ppeCatalogue.category, current.name)));
    }
    await this.db.delete(ppeCategories).where(and(eq(ppeCategories.id, id), eq(ppeCategories.tenantId, tenantId)));
    await this.cacheService.invalidate(tenantId, 'ppe');
    return { deleted: true };
  }

  async create(dto: CreatePpeDto, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);

    try {
      const [row] = await this.db
        .insert(ppeCatalogue)
        .values({
          tenantId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          category: dto.category,
          description: dto.description,
          isActive: dto.isActive ?? true,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.afterMutation(tenantId, user, 'ppe.created', row.id);
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException(`PPE code '${dto.code}' already exists`);
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const cached = await this.cacheService.get<(typeof ppeCatalogue.$inferSelect)[]>(
      tenantId,
      'ppe',
    );
    if (cached) {
      return cached;
    }

    const rows = await this.db
      .select()
      .from(ppeCatalogue)
      .where(eq(ppeCatalogue.tenantId, tenantId));

    await this.cacheService.set(tenantId, 'ppe', rows);
    return rows;
  }

  async update(id: string, dto: Partial<CreatePpeDto>, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const [row] = await this.db
      .update(ppeCatalogue)
      .set({
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(ppeCatalogue.id, id), eq(ppeCatalogue.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new ConflictException('PPE item not found');
    }

    await this.afterMutation(tenantId, user, 'ppe.updated', id);
    return row;
  }

  async remove(id: string, user: AuthenticatedUser, force = false) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    await this.referenceIntegrity.assertPpeNotReferenced(id, force);

    const [row] = await this.db
      .delete(ppeCatalogue)
      .where(and(eq(ppeCatalogue.id, id), eq(ppeCatalogue.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new ConflictException('PPE item not found');
    }

    await this.afterMutation(tenantId, user, 'ppe.deleted', id);
    return row;
  }

  private async afterMutation(
    tenantId: string,
    user: AuthenticatedUser,
    action: string,
    entityId: string,
  ) {
    await this.cacheService.invalidate(tenantId, 'ppe');
    await this.auditService.log({
      action,
      entityType: 'ppe_catalogue',
      entityId,
      userId: user.id,
      tenantId,
    });
    this.logService.logEvent({
      action,
      tenantId,
      userId: user.id,
      entityType: 'ppe_catalogue',
      entityId,
    });
  }
}
