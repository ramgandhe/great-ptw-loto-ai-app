import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';
import {
  organisations,
  permitTypes,
  platformMetadata,
} from './schema';
import { seedDemoWorkflows } from './seed-demo-workflows';
import { seedDefaultWorkflow } from './seed-default-workflow';
import { seedMasterCatalogue } from './seed-master-catalogue';
import { DEMO_IDS, DEMO_TENANT_ID, SEED_ACTOR_ID } from './seed-ids';

const DEMO_PERMIT_TYPES = [
  {
    id: DEMO_IDS.permitTypeHotWork,
    code: 'HOT-WORK',
    name: 'Hot Work',
    description: 'Welding, grinding, and other ignition-source work',
  },
  {
    id: DEMO_IDS.permitTypeColdWork,
    code: 'COLD-WORK',
    name: 'Cold Work',
    description: 'General maintenance without ignition sources',
  },
  {
    id: DEMO_IDS.permitTypeConfinedSpace,
    code: 'CONFINED-SPACE',
    name: 'Confined Space',
    description: 'Entry into tanks, vessels, pits, and other confined spaces',
  },
  {
    id: DEMO_IDS.permitTypeWorkingAtHeight,
    code: 'WORKING-AT-HEIGHT',
    name: 'Working at Height',
    description: 'Work above ground level requiring fall protection',
  },
  {
    id: DEMO_IDS.permitTypeElectrical,
    code: 'ELECTRICAL',
    name: 'Electrical',
    description: 'Electrical installation, maintenance, and isolation work',
  },
  {
    id: DEMO_IDS.permitTypeExcavation,
    code: 'EXCAVATION',
    name: 'Excavation',
    description: 'Digging, trenching, and ground disturbance',
  },
  {
    id: DEMO_IDS.permitTypeLifting,
    code: 'LIFTING',
    name: 'Lifting Operations',
    description: 'Crane, hoist, and critical lift activities',
  },
  {
    id: DEMO_IDS.permitTypeBreakingContainment,
    code: 'BREAKING-CONTAINMENT',
    name: 'Breaking Containment',
    description: 'Opening process lines, vessels, or equipment under residual hazard',
  },
  {
    id: DEMO_IDS.permitTypeGeneralWork,
    code: 'GENERAL-WORK',
    name: 'General Work',
    description: 'Routine non-hazardous work requiring permit control',
  },
] as const;

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
      createdBy: SEED_ACTOR_ID,
      updatedBy: SEED_ACTOR_ID,
    })
    .onConflictDoNothing();

  console.log('Seeding demo master data...');
  await db
    .insert(permitTypes)
    .values(
      DEMO_PERMIT_TYPES.map((permitType) => ({
        id: permitType.id,
        tenantId: DEMO_TENANT_ID,
        code: permitType.code,
        name: permitType.name,
        description: permitType.description,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: [permitTypes.tenantId, permitTypes.code],
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await seedMasterCatalogue(db);
  await seedDefaultWorkflow(db);
  await seedDemoWorkflows(db);

  console.log('Seed completed.');
  await pool.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

export { DEMO_IDS } from './seed-ids';
