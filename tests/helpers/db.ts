import { join } from 'path';

export const testDatabaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

export const migrationsFolder = join(__dirname, '../app/src/database/migrations');
