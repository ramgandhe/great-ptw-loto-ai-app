import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { machineryCatalogue, workstationCatalogue } from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CreateMachineryDto } from './dto/create-workstation.dto';
import { MasterDataCacheService } from './master-data-cache.service';
import { MasterDataLogService } from './master-data-log.service';
import { ReferenceIntegrityService } from './reference-integrity.service';

@Injectable()
export class MachineryService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cacheService: MasterDataCacheService,
    private readonly auditService: AuditService,
    private readonly logService: MasterDataLogService,
    private readonly referenceIntegrity: ReferenceIntegrityService,
  ) {}

  async create(dto: CreateMachineryDto, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    await this.assertWorkstationExists(tenantId, dto.workstationId);

    try {
      const [row] = await this.db
        .insert(machineryCatalogue)
        .values({
          tenantId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          description: dto.description,
          workstationId: dto.workstationId,
          isActive: dto.isActive ?? true,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      await this.afterMutation(tenantId, user, 'machinery.created', row.id);
      return row;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        throw new ConflictException(`Machinery code '${dto.code}' already exists`);
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    const cached = await this.cacheService.get<(typeof machineryCatalogue.$inferSelect)[]>(
      tenantId,
      'machinery',
    );
    if (cached) {
      return cached;
    }

    const rows = await this.db
      .select()
      .from(machineryCatalogue)
      .where(eq(machineryCatalogue.tenantId, tenantId));

    await this.cacheService.set(tenantId, 'machinery', rows);
    return rows;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const tenantId = this.referenceIntegrity.requireTenant(user);
    await this.referenceIntegrity.assertMachineryNotReferenced(tenantId, id);

    const [row] = await this.db
      .delete(machineryCatalogue)
      .where(and(eq(machineryCatalogue.id, id), eq(machineryCatalogue.tenantId, tenantId)))
      .returning();

    if (!row) {
      throw new ConflictException('Machinery not found');
    }

    await this.afterMutation(tenantId, user, 'machinery.deleted', id);
    return row;
  }

  private async assertWorkstationExists(tenantId: string, workstationId: string) {
    const [row] = await this.db
      .select()
      .from(workstationCatalogue)
      .where(
        and(
          eq(workstationCatalogue.id, workstationId),
          eq(workstationCatalogue.tenantId, tenantId),
        ),
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
    await this.cacheService.invalidate(tenantId, 'machinery');
    await this.auditService.log({
      action,
      entityType: 'machinery_catalogue',
      entityId,
      userId: user.id,
      tenantId,
    });
    this.logService.logEvent({
      action,
      tenantId,
      userId: user.id,
      entityType: 'machinery_catalogue',
      entityId,
    });
  }
}
