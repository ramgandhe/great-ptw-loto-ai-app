import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

type Database = NodePgDatabase<typeof schema>;

export function formatCertificateReference(year: number, sequence: number): string {
  return `EIC-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Generates the next tenant-scoped Energy Isolation Certificate reference for the current year.
 */
export async function generateCertificateReference(
  db: Pick<Database, 'execute'>,
  tenantId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const likePattern = `EIC-${year}-%`;

  const result = await db.execute<{ max_seq: string | null }>(sql`
    SELECT MAX(CAST(SPLIT_PART(certificate_number, '-', 3) AS INTEGER)) AS max_seq
    FROM isolation_certificates
    WHERE tenant_id = ${tenantId}
      AND certificate_number LIKE ${likePattern}
  `);

  const currentMax = Number(result.rows[0]?.max_seq ?? 0);
  return formatCertificateReference(year, currentMax + 1);
}
