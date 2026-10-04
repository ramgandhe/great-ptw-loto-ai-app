import { existsSync } from 'fs';
import { join } from 'path';

/** The API role (NOSUPERUSER, NOBYPASSRLS). */
export const apiDatabaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://ptw_api:ptw_api_dev_password@localhost:5432/ptw_platform';

/** The migration owner role (BYPASSRLS). Tests use it for migrations and fixtures only. */
export const ownerDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL ??
  'postgresql://ptw_owner:ptw_owner_dev_password@localhost:5432/ptw_platform';

export const migrationsFolder = join(__dirname, '../../app/src/database/migrations');

if (!existsSync(migrationsFolder)) {
  throw new Error(`Migrations folder not found: ${migrationsFolder}`);
}
