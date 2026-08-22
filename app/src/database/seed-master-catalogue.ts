import { sql } from 'drizzle-orm';
import type { Database } from './database.module';
import {
  agencies,
  contractors,
  departments,
  employees,
  hazardCategories,
  locations,
  machineryCatalogue,
  plants,
  ppeCatalogue,
  workstationCatalogue,
} from './schema';
import { DEMO_IDS, DEMO_TENANT_ID, SEED_ACTOR_ID } from './seed-ids';

const DEMO_PLANTS = [
  { id: DEMO_IDS.plant, code: 'PLANT-01', name: 'Demo Plant', description: 'Primary demonstration plant' },
  { id: DEMO_IDS.plantNorth, code: 'PLANT-02', name: 'North Plant', description: 'Northern processing unit' },
  { id: DEMO_IDS.plantSouth, code: 'PLANT-03', name: 'South Plant', description: 'Southern utilities block' },
  { id: DEMO_IDS.plantRefinery, code: 'PLANT-04', name: 'Refinery', description: 'Crude and product processing' },
  { id: DEMO_IDS.plantUtilities, code: 'PLANT-05', name: 'Utilities', description: 'Steam, air, and water systems' },
  { id: DEMO_IDS.plantTerminal, code: 'PLANT-06', name: 'Tank Terminal', description: 'Bulk storage and loading' },
] as const;

const DEMO_DEPARTMENTS = [
  { id: DEMO_IDS.department, plantId: DEMO_IDS.plant, code: 'OPS', name: 'Operations' },
  {
    id: DEMO_IDS.departmentMaintenance,
    plantId: DEMO_IDS.plant,
    code: 'MAINT',
    name: 'Maintenance',
  },
  {
    id: DEMO_IDS.departmentElectrical,
    plantId: DEMO_IDS.plantNorth,
    code: 'ELEC',
    name: 'Electrical',
  },
  {
    id: DEMO_IDS.departmentInstrumentation,
    plantId: DEMO_IDS.plantSouth,
    code: 'INST',
    name: 'Instrumentation',
  },
  { id: DEMO_IDS.departmentHse, plantId: DEMO_IDS.plantRefinery, code: 'HSE', name: 'HSE' },
  {
    id: DEMO_IDS.departmentUtilities,
    plantId: DEMO_IDS.plantUtilities,
    code: 'UTIL',
    name: 'Utilities',
  },
] as const;

const DEMO_LOCATIONS = [
  {
    id: DEMO_IDS.location,
    departmentId: DEMO_IDS.department,
    code: 'LOC-CB-01',
    name: 'Compressor Bay',
  },
  {
    id: DEMO_IDS.locationB,
    departmentId: DEMO_IDS.department,
    code: 'LOC-TF-01',
    name: 'Tank Farm',
  },
  {
    id: DEMO_IDS.locationBoilerHouse,
    departmentId: DEMO_IDS.departmentUtilities,
    code: 'LOC-BH-01',
    name: 'Boiler House',
  },
  {
    id: DEMO_IDS.locationLoadingBay,
    departmentId: DEMO_IDS.department,
    code: 'LOC-LB-01',
    name: 'Loading Bay',
  },
  {
    id: DEMO_IDS.locationControlRoom,
    departmentId: DEMO_IDS.departmentInstrumentation,
    code: 'LOC-CR-01',
    name: 'Control Room',
  },
  {
    id: DEMO_IDS.locationPipeRack,
    departmentId: DEMO_IDS.departmentMaintenance,
    code: 'LOC-PR-01',
    name: 'Pipe Rack',
  },
] as const;

const DEMO_HAZARDS = [
  { id: DEMO_IDS.hazardFire, code: 'FIRE', name: 'Fire / ignition', severity: 'high' },
  { id: DEMO_IDS.hazardElectrical, code: 'ELECTRICAL', name: 'Electrical energy', severity: 'critical' },
  { id: DEMO_IDS.hazardChemical, code: 'CHEMICAL', name: 'Chemical exposure', severity: 'high' },
  { id: DEMO_IDS.hazardFall, code: 'FALL', name: 'Fall from height', severity: 'critical' },
  {
    id: DEMO_IDS.hazardConfinedSpace,
    code: 'CONFINED-SPACE',
    name: 'Confined space',
    severity: 'critical',
  },
  { id: DEMO_IDS.hazardMechanical, code: 'MECHANICAL', name: 'Mechanical energy', severity: 'high' },
] as const;

const DEMO_PPE = [
  { id: DEMO_IDS.ppeHelmet, code: 'PPE-HELMET', name: 'Safety helmet', category: 'head' },
  { id: DEMO_IDS.ppeGloves, code: 'PPE-GLOVES', name: 'Chemical-resistant gloves', category: 'hand' },
  { id: DEMO_IDS.ppeGlasses, code: 'PPE-GLASSES', name: 'Safety glasses', category: 'eye' },
  { id: DEMO_IDS.ppeEarDefenders, code: 'PPE-EAR', name: 'Ear defenders', category: 'hearing' },
  { id: DEMO_IDS.ppeRespirator, code: 'PPE-RESP', name: 'Half-face respirator', category: 'respiratory' },
  { id: DEMO_IDS.ppeBoots, code: 'PPE-BOOTS', name: 'Safety boots', category: 'foot' },
] as const;

const DEMO_WORKSTATIONS = [
  {
    id: DEMO_IDS.workstation,
    code: 'WS-BAY-01',
    name: 'Compressor Bay',
    description: 'Primary LOTOTO demonstration workstation',
  },
  {
    id: DEMO_IDS.workstationB,
    code: 'WS-TANK-01',
    name: 'Tank Farm Manifold',
    description: 'SIMOPS overlap demonstration workstation',
  },
  {
    id: DEMO_IDS.workstationPumpSkid,
    code: 'WS-PUMP-01',
    name: 'Pump Skid',
    description: 'Feed and circulation pumps',
  },
  {
    id: DEMO_IDS.workstationMcc,
    code: 'WS-MCC-01',
    name: 'Electrical MCC',
    description: 'Motor control centre isolation point',
  },
  {
    id: DEMO_IDS.workstationScaffold,
    code: 'WS-SCAF-01',
    name: 'Scaffold Platform',
    description: 'Working at height demonstration area',
  },
  {
    id: DEMO_IDS.workstationValve,
    code: 'WS-VALVE-01',
    name: 'Valve Station',
    description: 'Manual valve isolation bank',
  },
] as const;

const DEMO_MACHINERY = [
  {
    id: DEMO_IDS.machineryCompressor,
    workstationId: DEMO_IDS.workstation,
    code: 'MC-COMP-01',
    name: 'Main compressor',
    description: 'High-pressure air compressor',
  },
  {
    id: DEMO_IDS.machineryPump,
    workstationId: DEMO_IDS.workstation,
    code: 'MC-PUMP-01',
    name: 'Cooling water pump',
    description: 'Ancillary cooling pump',
  },
  {
    id: DEMO_IDS.machineryFeedPump,
    workstationId: DEMO_IDS.workstationPumpSkid,
    code: 'MC-FEED-01',
    name: 'Feed pump',
    description: 'Process feed pump',
  },
  {
    id: DEMO_IDS.machineryHeatExchanger,
    workstationId: DEMO_IDS.workstationPumpSkid,
    code: 'MC-HX-01',
    name: 'Heat exchanger',
    description: 'Shell and tube exchanger',
  },
  {
    id: DEMO_IDS.machineryAgitator,
    workstationId: DEMO_IDS.workstationValve,
    code: 'MC-AGIT-01',
    name: 'Agitator motor',
    description: 'Tank agitator drive unit',
  },
  {
    id: DEMO_IDS.machineryConveyor,
    workstationId: DEMO_IDS.workstationMcc,
    code: 'MC-CONV-01',
    name: 'Conveyor drive',
    description: 'Belt conveyor motor starter',
  },
] as const;

const DEMO_AGENCIES = [
  { id: DEMO_IDS.agencyAlpha, code: 'AGY-ALPHA', name: 'Alpha Industrial Services' },
  { id: DEMO_IDS.agencyBeta, code: 'AGY-BETA', name: 'Beta Contracting Ltd' },
  { id: DEMO_IDS.agencyGamma, code: 'AGY-GAMMA', name: 'Gamma Scaffold Co' },
  { id: DEMO_IDS.agencyDelta, code: 'AGY-DELTA', name: 'Delta Electrical' },
  { id: DEMO_IDS.agencyEpsilon, code: 'AGY-EPSILON', name: 'Epsilon Insulation' },
  { id: DEMO_IDS.agencyZeta, code: 'AGY-ZETA', name: 'Zeta Lifting Services' },
] as const;

const DEMO_CONTRACTORS = [
  {
    id: DEMO_IDS.contractorLead,
    agencyId: DEMO_IDS.agencyAlpha,
    name: 'Ravi Sharma',
    email: 'ravi.sharma@contractor.local',
  },
  {
    id: DEMO_IDS.contractorTech1,
    agencyId: DEMO_IDS.agencyBeta,
    name: 'Meera Patel',
    email: 'meera.patel@contractor.local',
  },
  {
    id: DEMO_IDS.contractorTech2,
    agencyId: DEMO_IDS.agencyGamma,
    name: 'Arjun Singh',
    email: 'arjun.singh@contractor.local',
  },
  {
    id: DEMO_IDS.contractorTech3,
    agencyId: DEMO_IDS.agencyDelta,
    name: 'Priya Nair',
    email: 'priya.nair@contractor.local',
  },
  {
    id: DEMO_IDS.contractorTech4,
    agencyId: DEMO_IDS.agencyEpsilon,
    name: 'Karan Desai',
    email: 'karan.desai@contractor.local',
  },
  {
    id: DEMO_IDS.contractorTech5,
    agencyId: DEMO_IDS.agencyZeta,
    name: 'Sneha Iyer',
    email: 'sneha.iyer@contractor.local',
  },
] as const;

const DEMO_EXTRA_EMPLOYEES = [
  {
    id: DEMO_IDS.employeeMaintenance,
    name: 'Maintenance Supervisor',
    email: 'maintenance.supervisor@ptw.local',
    departmentId: DEMO_IDS.departmentMaintenance,
  },
  {
    id: DEMO_IDS.employeeElectrician,
    name: 'Lead Electrician',
    email: 'lead.electrician@ptw.local',
    departmentId: DEMO_IDS.departmentElectrical,
  },
] as const;

export async function seedMasterCatalogue(db: Database): Promise<void> {
  console.log('Seeding demo organisation hierarchy...');
  await db
    .insert(plants)
    .values(
      DEMO_PLANTS.map((plant) => ({
        id: plant.id,
        tenantId: DEMO_TENANT_ID,
        code: plant.code,
        name: plant.name,
        description: plant.description,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: [plants.tenantId, plants.code],
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(departments)
    .values(
      DEMO_DEPARTMENTS.map((department) => ({
        id: department.id,
        tenantId: DEMO_TENANT_ID,
        plantId: department.plantId,
        code: department.code,
        name: department.name,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: [departments.tenantId, departments.code],
      set: {
        name: sql`excluded.name`,
        plantId: sql`excluded.plant_id`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(locations)
    .values(
      DEMO_LOCATIONS.map((location) => ({
        id: location.id,
        tenantId: DEMO_TENANT_ID,
        departmentId: location.departmentId,
        code: location.code,
        name: location.name,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: [locations.tenantId, locations.code],
      set: {
        name: sql`excluded.name`,
        departmentId: sql`excluded.department_id`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  console.log('Seeding demo hazard and PPE catalogues...');
  await db
    .insert(hazardCategories)
    .values(
      DEMO_HAZARDS.map((hazard) => ({
        id: hazard.id,
        tenantId: DEMO_TENANT_ID,
        code: hazard.code,
        name: hazard.name,
        severity: hazard.severity,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: [hazardCategories.tenantId, hazardCategories.code],
      set: {
        name: sql`excluded.name`,
        severity: sql`excluded.severity`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(ppeCatalogue)
    .values(
      DEMO_PPE.map((ppe) => ({
        id: ppe.id,
        tenantId: DEMO_TENANT_ID,
        code: ppe.code,
        name: ppe.name,
        category: ppe.category,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: [ppeCatalogue.tenantId, ppeCatalogue.code],
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  console.log('Seeding demo workstations and machinery...');
  await db
    .insert(workstationCatalogue)
    .values(
      DEMO_WORKSTATIONS.map((workstation) => ({
        id: workstation.id,
        tenantId: DEMO_TENANT_ID,
        code: workstation.code,
        name: workstation.name,
        description: workstation.description,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: [workstationCatalogue.tenantId, workstationCatalogue.code],
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(machineryCatalogue)
    .values(
      DEMO_MACHINERY.map((machine) => ({
        id: machine.id,
        tenantId: DEMO_TENANT_ID,
        workstationId: machine.workstationId,
        code: machine.code,
        name: machine.name,
        description: machine.description,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: [machineryCatalogue.tenantId, machineryCatalogue.code],
      set: {
        name: sql`excluded.name`,
        workstationId: sql`excluded.workstation_id`,
        description: sql`excluded.description`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  console.log('Seeding demo workforce directory...');
  await db
    .insert(agencies)
    .values(
      DEMO_AGENCIES.map((agency) => ({
        id: agency.id,
        tenantId: DEMO_TENANT_ID,
        code: agency.code,
        name: agency.name,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: [agencies.tenantId, agencies.code],
      set: {
        name: sql`excluded.name`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(contractors)
    .values(
      DEMO_CONTRACTORS.map((contractor) => ({
        id: contractor.id,
        tenantId: DEMO_TENANT_ID,
        agencyId: contractor.agencyId,
        name: contractor.name,
        email: contractor.email,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: contractors.id,
      set: {
        name: sql`excluded.name`,
        email: sql`excluded.email`,
        agencyId: sql`excluded.agency_id`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(employees)
    .values(
      DEMO_EXTRA_EMPLOYEES.map((employee) => ({
        id: employee.id,
        tenantId: DEMO_TENANT_ID,
        name: employee.name,
        email: employee.email,
        departmentId: employee.departmentId,
        createdBy: SEED_ACTOR_ID,
        updatedBy: SEED_ACTOR_ID,
      })),
    )
    .onConflictDoUpdate({
      target: employees.id,
      set: {
        name: sql`excluded.name`,
        email: sql`excluded.email`,
        departmentId: sql`excluded.department_id`,
        updatedBy: SEED_ACTOR_ID,
        updatedAt: sql`now()`,
      },
    });
}
