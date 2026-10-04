import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { Tx } from '../../database/context';
import { tenantDataKeys } from '../../database/schema';
import { KeyService } from './key.service';

@Injectable()
export class TenantKeyService {
  constructor(private readonly keys: KeyService) {}

  /** The tenant's newest data key, created on first use. Concurrent first uses converge on version 1. */
  async current(tx: Tx, tenantId: string): Promise<{ version: number; key: Buffer }> {
    let row = await this.latest(tx, tenantId);
    if (!row) {
      const wrappedKey = await this.keys.createDataKey();
      await tx.insert(tenantDataKeys).values({ tenantId, version: 1, wrappedKey }).onConflictDoNothing();
      row = await this.latest(tx, tenantId);
    }
    if (!row) throw new Error('Tenant data key could not be created');
    return { version: row.version, key: await this.keys.unwrap(row.wrappedKey) };
  }

  async byVersion(tx: Tx, tenantId: string, version: number): Promise<Buffer> {
    const [row] = await tx
      .select()
      .from(tenantDataKeys)
      .where(and(eq(tenantDataKeys.tenantId, tenantId), eq(tenantDataKeys.version, version)));
    if (!row) throw new Error(`Tenant data key version ${version} is missing`);
    return this.keys.unwrap(row.wrappedKey);
  }

  private async latest(tx: Tx, tenantId: string) {
    const [row] = await tx
      .select()
      .from(tenantDataKeys)
      .where(eq(tenantDataKeys.tenantId, tenantId))
      .orderBy(desc(tenantDataKeys.version))
      .limit(1);
    return row;
  }
}
