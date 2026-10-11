import { and, eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { permitTemplates, permitTypes } from '../../database/schema';
import { REFERENCE_TEMPLATES } from './permit-template-library';

type TemplateDb = Pick<Database, 'insert' | 'select' | 'update'>;

export async function ensureReferenceTemplates(
  db: TemplateDb,
  tenantId: string,
  actorId: string,
): Promise<{ created: number; alreadyPresent: number; relinked: number }> {
  const [existing, types] = await Promise.all([
    db
      .select({
        id: permitTemplates.id,
        code: permitTemplates.code,
        status: permitTemplates.status,
        permitTypeIds: permitTemplates.permitTypeIds,
        appliesToAllTypes: permitTemplates.appliesToAllTypes,
      })
      .from(permitTemplates)
      .where(eq(permitTemplates.tenantId, tenantId)),
    db
      .select({ id: permitTypes.id, code: permitTypes.code })
      .from(permitTypes)
      .where(and(eq(permitTypes.tenantId, tenantId), eq(permitTypes.isActive, true))),
  ]);
  const have = new Map(existing.map((row) => [row.code, row]));
  let created = 0;
  let relinked = 0;

  for (const template of REFERENCE_TEMPLATES) {
    const current = have.get(template.code);
    const allTypes = template.permitTypeCodes.includes('*');
    const linkedIds = allTypes ? [] : types.filter((type) => template.permitTypeCodes.includes(type.code)).map((type) => type.id);

    if (current?.status === 'archived') {
      await db
        .update(permitTemplates)
        .set({
          status: 'published',
          ...(allTypes
            ? { appliesToAllTypes: true, permitTypeIds: [] }
            : current.permitTypeIds.length === 0 && linkedIds.length > 0
              ? { permitTypeIds: linkedIds }
              : {}),
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(and(eq(permitTemplates.id, current.id), eq(permitTemplates.tenantId, tenantId)));
      created += 1;
      continue;
    }

    if (current) {
      if (!allTypes && current.permitTypeIds.length === 0 && linkedIds.length > 0 && !current.appliesToAllTypes) {
        await db
          .update(permitTemplates)
          .set({ permitTypeIds: linkedIds, updatedBy: actorId, updatedAt: new Date() })
          .where(and(eq(permitTemplates.id, current.id), eq(permitTemplates.tenantId, tenantId)));
        relinked += 1;
      }
      continue;
    }

    await db.insert(permitTemplates).values({
      tenantId,
      name: template.name,
      code: template.code,
      description: template.description,
      status: 'published',
      permitTypeIds: linkedIds,
      appliesToAllTypes: allTypes,
      config: template.config,
      createdBy: actorId,
      updatedBy: actorId,
    });
    created += 1;
  }

  return { created, alreadyPresent: REFERENCE_TEMPLATES.length - created, relinked };
}
