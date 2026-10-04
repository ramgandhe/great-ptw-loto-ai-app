import { existsSync } from 'fs';
import { join } from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../app/src/database/schema';
import type { Database, DbContext } from '../../app/src/database/context';

/** The API role (NOSUPERUSER, NOBYPASSRLS). */
export const apiDatabaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://ptw_api:ptw_api_dev_password@localhost:5432/ptw_platform';

/** The migration owner role (BYPASSRLS). Tests use it for migrations and fixtures only. */
export const ownerDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL ??
  'postgresql://ptw_owner:ptw_owner_dev_password@localhost:5432/ptw_platform';

/** The bootstrap superuser. Tests use it only to arrange states no other role can create (never app/src). */
export const superuserDatabaseUrl =
  process.env.POSTGRES_SUPERUSER_URL ?? 'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

export const migrationsFolder = join(__dirname, '../../app/src/database/migrations');

if (!existsSync(migrationsFolder)) {
  throw new Error(`Migrations folder not found: ${migrationsFolder}`);
}

/** The API role. Specs query through runInContext, exactly as the API does. */
export function connectApi(max = 4): { pool: Pool; db: Database } {
  const pool = new Pool({ connectionString: apiDatabaseUrl, max });
  return { pool, db: drizzle(pool, { schema }) };
}

/** The owner role (BYPASSRLS), for migrations and fixtures only. */
export function connectOwner(): Pool {
  return new Pool({ connectionString: ownerDatabaseUrl });
}

export const userCtx = (tenantId: string, personId: string, legalEntityIds: string[]): DbContext => ({
  tenantId,
  personId,
  legalEntityIds,
  actingRole: 'user',
});
export const platformCtx: DbContext = { tenantId: null, personId: null, legalEntityIds: [], actingRole: 'platform_admin' };
export const noTenantJobCtx: DbContext = { tenantId: null, personId: null, legalEntityIds: [], actingRole: 'job' };

/** SQLSTATE of a pg error, whether or not Drizzle wrapped it. */
export function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

export async function pgErrorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return pgCode(error) ?? String(error);
  }
}
