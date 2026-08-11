import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';
import {
  departments,
  employees,
  hazardCategories,
  locations,
  machineryCatalogue,
  organisations,
  permitTypes,
  plants,
  platformMetadata,
  ppeCatalogue,
  workflowSteps,
  workstationCatalogue,
} from './schema';

const DEMO_TENANT_ID = '00000000-0000-4000-8000-000000000001';
const SEED_ACTOR_ID = '00000000-0000-4000-8000-000000000010';

export const DEMO_IDS = {
  tenantId: DEMO_TENANT_ID,
  permitTypeHotWork: '00000000-0000-4000-8000-000000000101',
  permitTypeColdWork: '00000000-0000-4000-8000-000000000102',
  plant: '00000000-0000-4000-8000-000000000103',
  department: '00000000-0000-4000-8000-000000000104',
  location: '00000000-0000-4000-8000-000000000105',
  hazardFire: '00000000-0000-4000-8000-000000000106',
  ppeHelmet: '00000000-0000-4000-8000-000000000107',
  workflowSupervisorStep: '00000000-0000-4000-8000-000000000108',
  workflowOrgAdminStep: '00000000-0000-4000-8000-000000000109',
  workstation: '00000000-0000-4000-8000-000000000110',
  machineryCompressor: '00000000-0000-4000-8000-000000000111',
  machineryPump: '00000000-0000-4000-8000-000000000112',
  employeeSupervisor: '00000000-0000-4000-8000-000000000113',
  employeeIssuer: '00000000-0000-4000-8000-000000000114',
  permitTypeConfinedSpace: '00000000-0000-4000-8000-000000000120',
  permitTypeWorkingAtHeight: '00000000-0000-4000-8000-000000000121',
  permitTypeElectrical: '00000000-0000-4000-8000-000000000122',
  permitTypeExcavation: '00000000-0000-4000-8000-000000000123',
  permitTypeLifting: '00000000-0000-4000-8000-000000000124',
  permitTypeBreakingContainment: '00000000-0000-4000-8000-000000000125',
  permitTypeGeneralWork: '00000000-0000-4000-8000-000000000126',
} as const;

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

  await db
    .insert(plants)
    .values({
      id: DEMO_IDS.plant,
      tenantId: DEMO_TENANT_ID,
      name: 'Demo Plant',
      code: 'PLANT-01',
      description: 'Primary demonstration plant',
      createdBy: SEED_ACTOR_ID,
      updatedBy: SEED_ACTOR_ID,
    })
    .onConflictDoNothing();

  await db
    .insert(departments)
    .values({
      id: DEMO_IDS.department,
      tenantId: DEMO_TENANT_ID,
      plantId: DEMO_IDS.plant,
      name: 'Operations',
      code: 'OPS',
      createdBy: SEED_ACTOR_ID,
      updatedBy: SEED_ACTOR_ID,
    })
    .onConflictDoNothing();

  await db
    .insert(locations)
    .values({
      id: DEMO_IDS.location,
      tenantId: DEMO_TENANT_ID,
      departmentId: DEMO_IDS.department,
      name: 'Tank Farm',
      code: 'LOC-TF-01',
      createdBy: SEED_ACTOR_ID,
      updatedBy: SEED_ACTOR_ID,
    })
    .onConflictDoNothing();

  await db
    .insert(hazardCategories)
    .values({
      id: DEMO_IDS.hazardFire,
      tenantId: DEMO_TENANT_ID,
      code: 'FIRE',
      name: 'Fire / ignition',
      severity: 'high',
      createdBy: SEED_ACTOR_ID,
      updatedBy: SEED_ACTOR_ID,
    })
    .onConflictDoNothing();

  await db
    .insert(ppeCatalogue)
    .values({
      id: DEMO_IDS.ppeHelmet,
      tenantId: DEMO_TENANT_ID,
      code: 'PPE-HELMET',
      name: 'Safety helmet',
      category: 'head',
      createdBy: SEED_ACTOR_ID,
      updatedBy: SEED_ACTOR_ID,
    })
    .onConflictDoNothing();

  console.log('Seeding demo workstations and machinery...');
  await db
    .insert(workstationCatalogue)
    .values({
      id: DEMO_IDS.workstation,
      tenantId: DEMO_TENANT_ID,
      code: 'WS-BAY-01',
      name: 'Compressor Bay',
      description: 'Primary LOTOTO demonstration workstation',
      createdBy: SEED_ACTOR_ID,
      updatedBy: SEED_ACTOR_ID,
    })
    .onConflictDoNothing();

  await db
    .insert(machineryCatalogue)
    .values([
      {
        id: DEMO_IDS.machineryCompressor,
        tenantId: DEMO_TENANT_ID,
        workstationId: DEMO_IDS.workstation,
        code: 'MC-COMP-01',
        name: 'Main compressor',
        description: 'High-pressure air compressor',
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        id: DEMO_IDS.machineryPump,
        tenantId: DEMO_TENANT_ID,
        workstationId: DEMO_IDS.workstation,
        code: 'MC-PUMP-01',
        name: 'Cooling water pump',
        description: 'Ancillary cooling pump',
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
    ])
    .onConflictDoNothing();

  console.log('Seeding demo workforce...');
  await db
    .insert(employees)
    .values([
      {
        id: DEMO_IDS.employeeSupervisor,
        tenantId: DEMO_TENANT_ID,
        name: 'Safety Supervisor',
        email: 'supervisor@ptw.local',
        departmentId: DEMO_IDS.department,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        id: DEMO_IDS.employeeIssuer,
        tenantId: DEMO_TENANT_ID,
        name: 'Job Issuer',
        email: 'issuer@ptw.local',
        departmentId: DEMO_IDS.department,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
    ])
    .onConflictDoNothing();

  console.log('Seeding demo approval workflow...');
  await db
    .insert(workflowSteps)
    .values([
      {
        id: DEMO_IDS.workflowSupervisorStep,
        tenantId: DEMO_TENANT_ID,
        permitTypeId: null,
        stepSequence: 1,
        name: 'Supervisor review',
        approverRole: 'supervisor',
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
      {
        id: DEMO_IDS.workflowOrgAdminStep,
        tenantId: DEMO_TENANT_ID,
        permitTypeId: null,
        stepSequence: 2,
        name: 'Safety officer review',
        approverRole: 'safety-officer',
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      },
    ])
    .onConflictDoNothing();

  console.log('Seed completed.');
  await pool.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
