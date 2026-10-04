import { Client, Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { apiDatabaseUrl, migrationsFolder, ownerDatabaseUrl } from './db';

// Database specs need both roles. A run that cannot reach them fails, instead of passing with them skipped.
export default async function globalSetup(): Promise<void> {
  if (process.env.SKIP_DB_TESTS === '1') return;
  for (const url of [ownerDatabaseUrl, apiDatabaseUrl]) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      await client.query('select 1');
    } catch (error) {
      const { code, message } = error as { code?: string; message: string };
      throw new Error(
        `Database tests need PostgreSQL at ${url.replace(/:[^:@/]+@/, ':***@')} (${code ?? message}). ` +
          'Start it, set DATABASE_URL and MIGRATION_DATABASE_URL, or set SKIP_DB_TESTS=1.',
      );
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  const keyServiceUrl = process.env.KEY_SERVICE_URL ?? 'http://localhost:8200';
  const health = await fetch(`${keyServiceUrl}/v1/sys/health`).catch(() => undefined);
  if (!health?.ok) {
    throw new Error(`Tests need the key service at ${keyServiceUrl}. Run: docker compose up -d openbao openbao-init`);
  }
  // Migrate once, as the owner role, before any spec runs.
  const pool = new Pool({ connectionString: ownerDatabaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}
