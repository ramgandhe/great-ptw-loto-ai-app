import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitHazards, permitPpe, permits } from '../../database/schema';

const IN_USE = 'is used on permits, so it cannot be deleted. Deactivate it instead.';

/**
 * Permits refer to catalogue rows without database foreign keys, so a delete would leave permits
 * pointing at nothing. Deletes check here first; records in use can only be deactivated.
 */
@Injectable()
export class ReferenceIntegrityService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async assertPermitTypeNotReferenced(tenantId: string, permitTypeId: string): Promise<void> {
    await this.assertUnused(permits, and(eq(permits.tenantId, tenantId), eq(permits.permitTypeId, permitTypeId)), 'This permit type');
  }

  async assertHazardCategoryNotReferenced(hazardCategoryId: string): Promise<void> {
    await this.assertUnused(permitHazards, eq(permitHazards.hazardCategoryId, hazardCategoryId), 'This hazard');
  }

  async assertPpeNotReferenced(ppeCatalogueId: string): Promise<void> {
    await this.assertUnused(permitPpe, eq(permitPpe.ppeCatalogueId, ppeCatalogueId), 'This PPE item');
  }

  async assertWorkstationNotReferenced(tenantId: string, workstationId: string): Promise<void> {
    await this.assertUnused(permits, and(eq(permits.tenantId, tenantId), eq(permits.workstationId, workstationId)), 'This workstation');
  }

  async assertMachineryNotReferenced(tenantId: string, machineryId: string): Promise<void> {
    await this.assertUnused(permits, and(eq(permits.tenantId, tenantId), eq(permits.machineryId, machineryId)), 'This machine');
  }

  requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }

  private async assertUnused(table: PgTable & { id: PgColumn }, where: SQL | undefined, what: string): Promise<void> {
    const [row] = await this.db.select({ id: table.id }).from(table).where(where).limit(1);
    if (row) {
      throw new ConflictException(`${what} ${IN_USE}`);
    }
  }
}
