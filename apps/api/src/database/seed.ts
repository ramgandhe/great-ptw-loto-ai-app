import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { platformMetadata } from './schema';

async function seed(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log('Seeding platform metadata...');
  await db
    .insert(platformMetadata)
    .values({
      key: 'platform.initialised',
      value: new Date().toISOString(),
    })
    .onConflictDoNothing();

  console.log('Seed completed.');
  await pool.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
