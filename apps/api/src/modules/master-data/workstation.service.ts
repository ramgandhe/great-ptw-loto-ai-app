import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { workstationCatalogue } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CreateWorkstationDto } from './dto/create-workstation.dto';
import { MasterDataCacheService } from './master-data-cache.service';
import { MasterDataLogService } from './master-data-log.service';
import { ReferenceIntegrityService } from './reference-integrity.service';

@Injectable()
export class WorkstationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cacheService: MasterDataCacheService,
    private readonly auditService: AuditService,
    private readonly logService: MasterDataLogService,
    private readonly referenceIntegrity: ReferenceIntegrityService,
  ) {}

  async create(dto: CreateWorkstationDto, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);

    try {
      const [row] = await this.db
        .insert(workstationCatalogue)
        .values({
          tenantId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          description: dto.description,
          isActive: dto.isActive ?? true,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.afterMutation(tenantId, user, 'workstation.created', row.id);
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException(`Workstation code '${dto.code}' already exists`);
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const cached = await this.cacheService.get<(typeof workstationCatalogue.$inferSelect)[]>(
      tenantId,
      'workstations',
    );
    if (cached) {
      return cached;
    }

    const rows = await this.db
      .select()
      .from(workstationCatalogue)
      .where(eq(workstationCatalogue.tenantId, tenantId));

    await this.cacheService.set(tenantId, 'workstations', rows);
    return rows;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    await this.referenceIntegrity.assertWorkstationNotReferenced(tenantId, id);

    const [row] = await this.db
      .delete(workstationCatalogue)
      .where(and(eq(workstationCatalogue.id, id), eq(workstationCatalogue.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new ConflictException('Workstation not found');
    }

    await this.afterMutation(tenantId, user, 'workstation.deleted', id);
    return row;
  }

  private async afterMutation(
    tenantId: string,
    user: AuthenticatedUser,
    action: string,
    entityId: string,
  ) {
    await this.cacheService.invalidate(tenantId, 'workstations');
    await this.auditService.log({
      action,
      entityType: 'workstation_catalogue',
      entityId,
      userId: user.id,
      tenantId,
    });
    this.logService.logEvent({
      action,
      tenantId,
      userId: user.id,
      entityType: 'workstation_catalogue',
      entityId,
    });
  }
}
