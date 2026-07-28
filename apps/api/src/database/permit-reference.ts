import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

type Database = NodePgDatabase<typeof schema>;

export function formatPermitReference(year: number, sequence: number): string {
  return `PTW-${year}-${String(sequence).padStart(6, '0')}`;
}

/**
 * Generates the next tenant-scoped permit reference for the current year.
 * Relies on existing references in the permits table (no separate sequence table).
 */
export async function generatePermitReference(
  db: Database,
  tenantId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PTW-${year}-`;

  const result = await db.execute<{ max_seq: string | null }>(sql`
    SELECT MAX(CAST(SUBSTRING(reference FROM ${prefix.length + 1}) AS INTEGER)) AS max_seq
    FROM permits
    WHERE tenant_id = ${tenantId}
      AND reference LIKE ${`${prefix}%`}
  `);

  const currentMax = Number(result.rows[0]?.max_seq ?? 0);
  return formatPermitReference(year, currentMax + 1);
}
