import { BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { energySources } from '../../database/schema';
import { LOTOTO_ENERGY_TYPES } from './lototo.constants';

type EnergyDb = Pick<Database, 'select'>;

/** Tenant rows when the tenant was created with a copy. Otherwise the original fixed list. */
export async function allowedEnergyCodes(db: EnergyDb, tenantId: string): Promise<Set<string>> {
  const rows = await db
    .select({ code: energySources.code })
    .from(energySources)
    .where(eq(energySources.tenantId, tenantId));
  if (rows.length === 0) {
    return new Set(LOTOTO_ENERGY_TYPES);
  }
  return new Set(rows.map((row) => row.code));
}

export async function assertAllowedEnergyType(db: EnergyDb, tenantId: string, energyType: string) {
  const allowed = await allowedEnergyCodes(db, tenantId);
  if (!allowed.has(energyType)) {
    throw new BadRequestException('Choose an energy source from the list');
  }
}
