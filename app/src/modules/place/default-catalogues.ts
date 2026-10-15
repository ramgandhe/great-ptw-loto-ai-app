import { and, eq } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import type { Database } from '../../database/database.module';
import { locationTypes, ppeCatalogue, ppeCategories } from '../../database/schema';

export const DEFAULT_LOCATION_TYPES = [
  'Plant',
  'Building',
  'Unit',
  'Area',
  'Zone',
  'Workplace',
  'Room',
  'Workshop',
  'Warehouse',
  'Tank Farm',
] as const;

export const DEFAULT_PPE_CATEGORIES = [
  'Head Protection',
  'Eye Protection',
  'Face Protection',
  'Hearing Protection',
  'Respiratory Protection',
  'Hand Protection',
  'Foot Protection',
  'Body Protection',
  'Fall Protection',
  'Welding Protection',
  'Electrical Protection',
] as const;

export const DEFAULT_PPE_ITEMS: ReadonlyArray<{
  code: string;
  name: string;
  category: (typeof DEFAULT_PPE_CATEGORIES)[number];
  description: string;
}> = [
  { code: 'PPE-01', name: 'Safety Helmet', category: 'Head Protection', description: 'Protects the head against falling objects, impacts, and workplace hazards.' },
  { code: 'PPE-02', name: 'Safety Goggles', category: 'Eye Protection', description: 'Protects eyes from dust, flying particles, and other workplace hazards.' },
  { code: 'PPE-03', name: 'Face Shield', category: 'Face Protection', description: 'Protects the face from splashes, sparks, and flying debris.' },
  { code: 'PPE-04', name: 'Safety Glasses', category: 'Eye Protection', description: 'Provides eye protection against impact and airborne particles.' },
  { code: 'PPE-05', name: 'Ear Plugs', category: 'Hearing Protection', description: 'Reduces exposure to excessive workplace noise.' },
  { code: 'PPE-06', name: 'Ear Muffs', category: 'Hearing Protection', description: 'Provides hearing protection in high-noise environments.' },
  { code: 'PPE-07', name: 'Dust Mask', category: 'Respiratory Protection', description: 'Helps protect against dust and non-hazardous airborne particles, depending on the mask rating.' },
  { code: 'PPE-08', name: 'Respirator', category: 'Respiratory Protection', description: 'Protects against specified airborne contaminants when appropriately selected and fitted.' },
  { code: 'PPE-09', name: 'Safety Gloves', category: 'Hand Protection', description: 'Protects hands against general workplace hazards and abrasion.' },
  { code: 'PPE-10', name: 'Chemical-Resistant Gloves', category: 'Hand Protection', description: 'Protects hands from specified chemicals based on glove material compatibility.' },
  { code: 'PPE-11', name: 'Cut-Resistant Gloves', category: 'Hand Protection', description: 'Helps prevent cuts and lacerations when handling sharp materials.' },
  { code: 'PPE-12', name: 'Safety Shoes', category: 'Foot Protection', description: 'Protects feet against impact, compression, and other specified workplace hazards.' },
  { code: 'PPE-13', name: 'Safety Gumboots', category: 'Foot Protection', description: 'Provides foot protection in wet, muddy, or contaminated environments.' },
  { code: 'PPE-14', name: 'High-Visibility Vest', category: 'Body Protection', description: 'Improves worker visibility in traffic, construction, and industrial areas.' },
  { code: 'PPE-15', name: 'Coverall', category: 'Body Protection', description: 'Provides protective clothing against workplace dirt, abrasion, and specified hazards.' },
  { code: 'PPE-16', name: 'Chemical-Resistant Apron', category: 'Body Protection', description: 'Protects the torso and clothing against specified chemical splashes.' },
  { code: 'PPE-17', name: 'Welding Helmet', category: 'Welding Protection', description: 'Protects the face and eyes from welding radiation, sparks, and spatter.' },
  { code: 'PPE-18', name: 'Welding Gloves', category: 'Hand Protection', description: 'Protects hands from welding heat, sparks, and spatter.' },
  { code: 'PPE-19', name: 'Safety Harness', category: 'Fall Protection', description: 'Provides a body support system for approved fall-arrest applications.' },
  { code: 'PPE-20', name: 'Fall-Arrest Lanyard', category: 'Fall Protection', description: 'Connects a compatible full-body harness to an approved anchorage or fall-arrest system.' },
  { code: 'PPE-21', name: 'Knee Pads', category: 'Body Protection', description: 'Cushions and protects knees during kneeling tasks.' },
  { code: 'PPE-22', name: 'Chemical Splash Goggles', category: 'Eye Protection', description: 'Protects eyes against specified liquid chemical splashes.' },
  { code: 'PPE-23', name: 'Heat-Resistant Gloves', category: 'Hand Protection', description: 'Protects hands when handling hot materials or working in high-temperature environments.' },
  { code: 'PPE-24', name: 'Electrical Insulating Gloves', category: 'Electrical Protection', description: "Provides electrical insulation for approved tasks within the gloves' rated voltage and usage conditions." },
  { code: 'PPE-25', name: 'Disposable Protective Coverall', category: 'Body Protection', description: 'Provides disposable protection against specified dust, particles, or contaminants.' },
  { code: 'PPE-26', name: 'Welding Safety Shoes', category: 'Foot Protection', description: 'Provides foot protection in welding environments, including specified heat and spatter hazards.' },
  { code: 'PPE-27', name: 'Chemical-Resistant Boots', category: 'Foot Protection', description: 'Protects feet against specified chemical exposure and liquid penetration.' },
  { code: 'PPE-28', name: 'Chin Strap', category: 'Head Protection', description: 'Helps secure a compatible safety helmet during movement or work at height.' },
  { code: 'PPE-29', name: 'Arc-Flash Protective Suit', category: 'Electrical Protection', description: 'Provides protection against thermal hazards from electrical arc-flash incidents when appropriately rated.' },
  { code: 'PPE-30', name: 'Personal Protective Clothing', category: 'Body Protection', description: 'Provides general protective clothing selected according to identified workplace hazards.' },
];

/** Called when a tenant is created. Existing tenants are left unchanged. */
export async function ensureDefaultPlaceCatalogues(
  db: Pick<Database, 'insert' | 'select'>,
  tenantId: string,
  actorId: string | null | undefined,
) {
  const actor = optionalUuid(actorId ?? undefined) ?? null;
  for (const name of DEFAULT_LOCATION_TYPES) {
    const [existing] = await db
      .select({ id: locationTypes.id })
      .from(locationTypes)
      .where(and(eq(locationTypes.tenantId, tenantId), eq(locationTypes.name, name)));
    if (existing) continue;
    await db.insert(locationTypes).values({
      tenantId,
      name,
      createdBy: actor,
      updatedBy: actor,
    });
  }
  for (const name of DEFAULT_PPE_CATEGORIES) {
    const [existing] = await db
      .select({ id: ppeCategories.id })
      .from(ppeCategories)
      .where(and(eq(ppeCategories.tenantId, tenantId), eq(ppeCategories.name, name)));
    if (existing) continue;
    await db.insert(ppeCategories).values({
      tenantId,
      name,
      createdBy: actor,
      updatedBy: actor,
    });
  }
  for (const item of DEFAULT_PPE_ITEMS) {
    const [existing] = await db
      .select({ id: ppeCatalogue.id })
      .from(ppeCatalogue)
      .where(and(eq(ppeCatalogue.tenantId, tenantId), eq(ppeCatalogue.code, item.code)));
    if (existing) continue;
    await db.insert(ppeCatalogue).values({
      tenantId,
      code: item.code,
      name: item.name,
      category: item.category,
      description: item.description,
      createdBy: actor,
      updatedBy: actor,
    });
  }
}
