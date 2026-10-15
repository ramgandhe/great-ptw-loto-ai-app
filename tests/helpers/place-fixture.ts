import { randomUUID } from 'crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../app/src/database/schema';

type Db = NodePgDatabase<typeof schema>;

/** A site, one work location and one asset for an HTTP fixture. */
export async function insertAssetTarget(
  db: Db,
  input: { tenantId: string; createdBy?: string | null; name?: string; assetId?: string },
) {
  const siteId = randomUUID();
  const workLocationId = randomUUID();
  const assetId = input.assetId ?? randomUUID();
  const suffix = assetId.slice(0, 8);
  const actor = input.createdBy ?? null;

  await db.insert(schema.sites).values({
    id: siteId,
    tenantId: input.tenantId,
    code: `SITE-${suffix}`,
    name: input.name ?? 'Test site',
    status: 'active',
    createdBy: actor,
    updatedBy: actor,
  });
  await db.insert(schema.workLocations).values({
    id: workLocationId,
    tenantId: input.tenantId,
    siteId,
    code: `LOC-${suffix}`,
    name: input.name ?? 'Test location',
    status: 'active',
    pathText: `${input.name ?? 'Test site'} › Test location`,
    createdBy: actor,
    updatedBy: actor,
  });
  await db.insert(schema.assets).values({
    id: assetId,
    tenantId: input.tenantId,
    siteId,
    workLocationId,
    tag: `TAG-${suffix}`,
    name: input.name ?? 'Test asset',
    status: 'active',
    createdBy: actor,
    updatedBy: actor,
  });

  return { siteId, workLocationId, assetId };
}
