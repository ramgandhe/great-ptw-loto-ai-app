import { and, eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { permitTypes } from '../../database/schema';

/** Catalogue from docs/specs/ptw_permittypes.md. Aliases match older seed codes. */
export const DEFAULT_PERMIT_TYPES = [
  {
    code: 'HOT',
    name: 'Hot Work Permit',
    description:
      'Authorizes work that generates flames, sparks, heat, or other ignition sources in areas where fire or explosion hazards may exist. Examples: Welding, gas cutting, grinding, brazing, and other ignition-producing activities.',
    color: '#DC2626',
    aliases: ['HOT-WORK'],
  },
  {
    code: 'COLD',
    name: 'Cold Work Permit',
    description:
      'Authorizes non-hot-work activities following hazard assessment and implementation of applicable safety precautions, operational controls, and required isolations. Examples: Routine mechanical maintenance, manual repairs, equipment inspection, and non-sparking maintenance activities.',
    color: '#16A34A',
    aliases: ['COLD-WORK'],
  },
  {
    code: 'CSP',
    name: 'Confined Space Permit',
    description:
      'Controls entry into designated confined spaces where atmospheric, engulfment, access, or other serious hazards may exist. Examples: Tank entry, vessel inspection, and entry into designated pits or enclosed spaces.',
    color: '#7C3AED',
    aliases: ['CONFINED-SPACE', 'CONFINED'],
  },
  {
    code: 'ELEC',
    name: 'Electrical Permit',
    description:
      'Controls electrical work involving hazards such as electric shock, arc flash, stored energy, and unexpected energization. Examples: Electrical maintenance, panel work, cable repair, and work on electrical equipment.',
    color: '#2563EB',
    aliases: ['ELECTRICAL'],
  },
  {
    code: 'WAH',
    name: 'Work at Height Permit',
    description:
      "Controls work at elevated locations where a person could fall and suffer injury, according to the site's permit requirements. Examples: Roof maintenance, elevated structural repairs, and work on scaffolds or elevated platforms.",
    color: '#D97706',
    aliases: ['WORKING-AT-HEIGHT'],
  },
  {
    code: 'EXC',
    name: 'Excavation Permit',
    description:
      'Controls ground disturbance and excavation activities where buried services, ground instability, hazardous atmospheres, or other site hazards may exist. Examples: Trenching, foundation excavation, ground breaking, and underground utility investigation.',
    color: '#92400E',
    aliases: ['EXCAVATION'],
  },
] as const;

type PermitTypeDb = Pick<Database, 'insert' | 'select' | 'update'>;

export async function ensureDefaultPermitTypes(
  db: PermitTypeDb,
  tenantId: string,
  actorId: string,
): Promise<{ created: number; updated: number }> {
  const existing = await db.select().from(permitTypes).where(eq(permitTypes.tenantId, tenantId));
  let created = 0;
  let updated = 0;

  for (const type of DEFAULT_PERMIT_TYPES) {
    const byCode = existing.find((row) => row.code === type.code);
    if (byCode) {
      continue;
    }
    const byAlias = existing.find((row) => (type.aliases as readonly string[]).includes(row.code));
    if (byAlias) {
      await db
        .update(permitTypes)
        .set({
          code: type.code,
          name: type.name,
          description: type.description,
          color: type.color,
          isActive: true,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(and(eq(permitTypes.id, byAlias.id), eq(permitTypes.tenantId, tenantId)));
      byAlias.code = type.code;
      updated += 1;
      continue;
    }
    const [row] = await db
      .insert(permitTypes)
      .values({
        tenantId,
        code: type.code,
        name: type.name,
        description: type.description,
        color: type.color,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();
    existing.push(row);
    created += 1;
  }

  return { created, updated };
}
