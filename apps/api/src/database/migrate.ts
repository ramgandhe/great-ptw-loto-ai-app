import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

async function runMigrations(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder: './src/database/migrations' });
  console.log('Migrations completed.');

  await pool.end();
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
