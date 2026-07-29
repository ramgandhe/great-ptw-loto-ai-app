import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { ppeCatalogue } from '../../database/schema';
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

  async remove(id: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    await this.referenceIntegrity.assertPpeNotReferenced(id);

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
