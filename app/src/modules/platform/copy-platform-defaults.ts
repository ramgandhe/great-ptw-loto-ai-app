import { and, eq } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import type { Database } from '../../database/database.module';
import {
  assetTypes,
  defaultAssetTypes,
  defaultEnergySources,
  defaultLocationTypes,
  defaultPermitTypes,
  defaultPpeCategories,
  defaultPpeItems,
  energySources,
  locationTypes,
  permitTypes,
  ppeCatalogue,
  ppeCategories,
} from '../../database/schema';

type CopyDb = Pick<Database, 'insert' | 'select'>;

/** Copies the current platform catalogues onto a new tenant. Existing tenants are not updated. */
export async function copyPlatformDefaults(
  db: CopyDb,
  tenantId: string,
  actorId: string | null | undefined,
) {
  const actor = optionalUuid(actorId ?? undefined) ?? null;

  const locations = await db.select().from(defaultLocationTypes);
  for (const row of locations) {
    if (row.name.trim().toLowerCase() === 'site') continue;
    const [existing] = await db
      .select({ id: locationTypes.id })
      .from(locationTypes)
      .where(and(eq(locationTypes.tenantId, tenantId), eq(locationTypes.name, row.name)));
    if (existing) continue;
    await db.insert(locationTypes).values({
      tenantId,
      name: row.name,
      description: row.description,
      createdBy: actor,
      updatedBy: actor,
    });
  }

  const categories = await db.select().from(defaultPpeCategories);
  for (const row of categories) {
    const [existing] = await db
      .select({ id: ppeCategories.id })
      .from(ppeCategories)
      .where(and(eq(ppeCategories.tenantId, tenantId), eq(ppeCategories.name, row.name)));
    if (existing) continue;
    await db.insert(ppeCategories).values({
      tenantId,
      name: row.name,
      createdBy: actor,
      updatedBy: actor,
    });
  }

  const items = await db
    .select({
      code: defaultPpeItems.code,
      name: defaultPpeItems.name,
      description: defaultPpeItems.description,
      category: defaultPpeCategories.name,
    })
    .from(defaultPpeItems)
    .innerJoin(defaultPpeCategories, eq(defaultPpeItems.categoryId, defaultPpeCategories.id));
  for (const row of items) {
    const [existing] = await db
      .select({ id: ppeCatalogue.id })
      .from(ppeCatalogue)
      .where(and(eq(ppeCatalogue.tenantId, tenantId), eq(ppeCatalogue.code, row.code)));
    if (existing) continue;
    await db.insert(ppeCatalogue).values({
      tenantId,
      code: row.code,
      name: row.name,
      category: row.category,
      description: row.description,
      createdBy: actor,
      updatedBy: actor,
    });
  }

  const sources = await db.select().from(defaultEnergySources);
  for (const row of sources) {
    const [existing] = await db
      .select({ id: energySources.id })
      .from(energySources)
      .where(and(eq(energySources.tenantId, tenantId), eq(energySources.code, row.code)));
    if (existing) continue;
    await db.insert(energySources).values({
      tenantId,
      code: row.code,
      name: row.name,
      createdBy: actor,
      updatedBy: actor,
    });
  }

  const types = await db.select().from(defaultPermitTypes);
  for (const row of types) {
    const [existing] = await db
      .select({ id: permitTypes.id })
      .from(permitTypes)
      .where(and(eq(permitTypes.tenantId, tenantId), eq(permitTypes.code, row.code)));
    if (existing) continue;
    await db.insert(permitTypes).values({
      tenantId,
      code: row.code,
      name: row.name,
      description: row.description,
      color: row.color,
      isActive: true,
      createdBy: actor,
      updatedBy: actor,
    });
  }

  const assetTypeRows = await db.select().from(defaultAssetTypes);
  for (const row of assetTypeRows) {
    const [existing] = await db
      .select({ id: assetTypes.id })
      .from(assetTypes)
      .where(and(eq(assetTypes.tenantId, tenantId), eq(assetTypes.name, row.name)));
    if (existing) continue;
    await db.insert(assetTypes).values({
      tenantId,
      name: row.name,
      description: row.description,
      createdBy: actor,
      updatedBy: actor,
    });
  }
}
