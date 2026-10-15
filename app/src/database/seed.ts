import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';
import {
  organisations,
  industries,
  permitTypes,
  platformMetadata,
} from './schema';
import { seedDemoWorkflows } from './seed-demo-workflows';
import { seedDefaultWorkflow } from './seed-default-workflow';
import { seedMasterCatalogue } from './seed-master-catalogue';
import { ensureDefaultApprovalWorkflowForAllTenants } from '../modules/approval/ensure-default-workflow';
import { DEFAULT_PERMIT_TYPES } from '../modules/master-data/default-permit-types';
import { ensureReferenceTemplates } from '../modules/organisation/ensure-reference-templates';
import { DEMO_IDS, DEMO_TENANT_ID, SEED_ACTOR_ID } from './seed-ids';

const DEMO_SPEC_TYPE_IDS: Record<(typeof DEFAULT_PERMIT_TYPES)[number]['code'], string> = {
  HOT: DEMO_IDS.permitTypeHotWork,
  COLD: DEMO_IDS.permitTypeColdWork,
  CSP: DEMO_IDS.permitTypeConfinedSpace,
  ELEC: DEMO_IDS.permitTypeElectrical,
  WAH: DEMO_IDS.permitTypeWorkingAtHeight,
  EXC: DEMO_IDS.permitTypeExcavation,
};

const DEMO_EXTRA_PERMIT_TYPES = [
  {
    id: DEMO_IDS.permitTypeLifting,
    code: 'LIFTING',
    name: 'Lifting Operations',
    description: 'Crane, hoist, and critical lift activities',
    color: '#0D9488',
  },
  {
    id: DEMO_IDS.permitTypeBreakingContainment,
    code: 'BREAKING-CONTAINMENT',
    name: 'Breaking Containment',
    description: 'Opening process lines, vessels, or equipment under residual hazard',
    color: '#BE185D',
  },
  {
    id: DEMO_IDS.permitTypeGeneralWork,
    code: 'GENERAL-WORK',
    name: 'General Work',
    description: 'Routine non-hazardous work requiring permit control',
    color: '#64748B',
  },
  {
    id: DEMO_IDS.permitTypeHazardousArea,
    code: 'HAZARDOUS-AREA',
    name: 'Hazardous Area Work',
    description: 'Hazardous material handling and tank cleaning',
    color: '#65A30D',
  },
  {
    id: DEMO_IDS.permitTypeEquipmentShifting,
    code: 'EQUIPMENT-SHIFTING',
    name: 'Machine / Equipment Shifting',
    description: 'Moving machines and equipment, including isolation and load handling',
    color: '#0369A1',
  },
] as const;

const DEMO_PERMIT_TYPES = [
  ...DEFAULT_PERMIT_TYPES.map((type) => ({
    id: DEMO_SPEC_TYPE_IDS[type.code],
    code: type.code,
    name: type.name,
    description: type.description,
    color: type.color,
  })),
  ...DEMO_EXTRA_PERMIT_TYPES,
];

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
  const [fallbackIndustry] = await db
    .select({ id: industries.id })
    .from(industries)
    .where(eq(industries.isFallback, true));
  if (!fallbackIndustry) {
    throw new Error('Default industry is missing. Run migrations first.');
  }
  await db
    .insert(organisations)
    .values({
      tenantId: DEMO_TENANT_ID,
      name: 'Demo Organisation',
      legalName: 'Demo Organisation Ltd',
      registrationNumber: 'DEMO-001',
      industryId: fallbackIndustry.id,
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
        color: permitType.color,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: permitTypes.id,
      set: {
        code: sql`excluded.code`,
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        color: sql`excluded.color`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await seedMasterCatalogue(db);
  await seedDefaultWorkflow(db);
  await ensureDefaultApprovalWorkflowForAllTenants(db, SEED_ACTOR_ID);
  await ensureReferenceTemplates(db, DEMO_TENANT_ID, SEED_ACTOR_ID);
  await seedDemoWorkflows(db);

  console.log('Seed completed.');
  await pool.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

export { DEMO_IDS } from './seed-ids';
