import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { organisations, platformMetadata } from './schema';

const DEMO_TENANT_ID = '00000000-0000-4000-8000-000000000001';

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

  console.log('Seeding demo organisation...');
  await db
    .insert(organisations)
    .values({
      tenantId: DEMO_TENANT_ID,
      name: 'Demo Organisation',
      legalName: 'Demo Organisation Ltd',
      registrationNumber: 'DEMO-001',
      createdBy: randomUUID(),
      updatedBy: randomUUID(),
    })
    .onConflictDoNothing();

  console.log('Seed completed.');
  await pool.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
