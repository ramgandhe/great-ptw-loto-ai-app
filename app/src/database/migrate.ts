import { join } from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const migrationsFolder = join(__dirname, 'migrations');

async function runMigrations(): Promise<void> {
  // Runs as the owner role, in its own process. No default: this file ships in the API image, and the running
  // API must never hold an owner credential (NFR-SEC-001a).
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error('Set MIGRATION_DATABASE_URL (the owner role) for this command only');
  const pool = new Pool({ connectionString });
  console.log('Running database migrations...');
  await migrate(drizzle(pool), { migrationsFolder });
  console.log('Migrations completed.');
  await pool.end();
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
