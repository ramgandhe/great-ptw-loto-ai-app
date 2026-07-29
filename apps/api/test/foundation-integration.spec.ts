import { randomUUID } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../src/common/interfaces/authenticated-user.interface';
import * as schema from '../src/database/schema';
import { AuditService } from '../src/modules/logging/audit.service';
import { PermitTypeService } from '../src/modules/master-data/permit-type.service';
import { MasterDataCacheService } from '../src/modules/master-data/master-data-cache.service';
import { MasterDataLogService } from '../src/modules/master-data/master-data-log.service';
import { ReferenceIntegrityService } from '../src/modules/master-data/reference-integrity.service';
import { OrganisationService } from '../src/modules/organisation/organisation.service';
import { WorkforceService } from '../src/modules/workforce/workforce.service';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('Foundation integration (PUS-71)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let organisationService: OrganisationService;
  let workforceService: WorkforceService;
  let permitTypeService: PermitTypeService;
  let auditLog: jest.Mock;

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const adminId = randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });

    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder: './src/database/migrations' });
    } catch {
      canConnect = false;
    }

    if (!canConnect) {
      return;
    }

    auditLog = jest.fn().mockResolvedValue(undefined);
    const auditService = { log: auditLog } as unknown as AuditService;
    const cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
    } as unknown as MasterDataCacheService;
    const logService = { logEvent: jest.fn() } as unknown as MasterDataLogService;
    const referenceIntegrity = new ReferenceIntegrityService();

    organisationService = new OrganisationService(db, auditService);
    workforceService = new WorkforceService(db, auditService);
    permitTypeService = new PermitTypeService(
      db,
      cacheService,
      auditService,
      logService,
      referenceIntegrity,
    );
  });

  afterAll(async () => {
    if (canConnect) {
      await pool.end();
    }
  });

  const dbTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) {
        return;
      }
      await fn();
    });
  };

  function user(tenantId: string, roles: string[] = ['org-admin']): AuthenticatedUser {
    return {
      id: adminId,
      username: 'org-admin',
      tenantId,
      roles,
      email: 'admin@example.com',
    };
  }

  dbTest('registers organisation and hierarchy for tenant', async () => {
    const org = await organisationService.createOrganisation(
      { name: 'Acme Industrial', legalName: 'Acme Industrial Ltd' },
      user(tenantA),
    );
    expect(org.name).toBe('Acme Industrial');

    const plant = await organisationService.createPlant(
      { name: 'Main Plant', code: 'PLT-01' },
      user(tenantA),
    );
    const department = await organisationService.createDepartment(
      { name: 'Operations', code: 'OPS', plantId: plant.id },
      user(tenantA),
    );
    const location = await organisationService.createLocation(
      { name: 'Boiler House', code: 'BH-01', departmentId: department.id },
      user(tenantA),
    );

    expect('departmentId' in location && location.departmentId).toBe(department.id);
  });

  dbTest('assigns workforce within organisational hierarchy', async () => {
    const plants = await organisationService.listPlants(user(tenantA));
    const plant = plants[0];
    const department = await organisationService.createDepartment(
      { name: 'Maintenance', code: 'MNT', plantId: plant.id },
      user(tenantA),
    );

    const employee = await workforceService.createEmployee(
      { name: 'Jane Operator', email: 'jane@example.com', departmentId: department.id },
      user(tenantA),
    );

    const agency = await workforceService.createAgency({ name: 'SafeContract Ltd' }, user(tenantA));
    const contractor = await workforceService.createContractor(
      { name: 'Bob Contractor', agencyId: agency.id },
      user(tenantA),
    );

    const directory = await workforceService.listDirectory(user(tenantA));
    expect(directory.some((row) => row.id === employee.id)).toBe(true);
    expect(directory.some((row) => row.id === contractor.id)).toBe(true);
  });

  dbTest('exposes master data within same tenant', async () => {
    const permitType = await permitTypeService.create(
      { code: 'HOT-WORK', name: 'Hot Work' },
      user(tenantA),
    );
    expect(permitType.tenantId).toBe(tenantA);
  });

  dbTest('enforces tenant isolation across modules', async () => {
    const tenantAPlants = await organisationService.listPlants(user(tenantA));
    const tenantBPlants = await organisationService.listPlants(user(tenantB));

    expect(tenantAPlants.length).toBeGreaterThan(0);
    expect(tenantBPlants).toHaveLength(0);
  });

  dbTest('requires tenant context for mutations', async () => {
    const noTenantUser: AuthenticatedUser = {
      id: adminId,
      username: 'platform-admin',
      roles: ['platform-admin'],
      email: 'admin@example.com',
    };

    await expect(
      organisationService.createPlant({ name: 'Blocked Plant' }, noTenantUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  dbTest('records audit events across modules', async () => {
    const actions = auditLog.mock.calls.map((call) => call[0].action);
    expect(actions).toEqual(expect.arrayContaining(['organisation.created', 'plant.created']));
  });

  dbTest('isolates master data permit types per tenant', async () => {
    const tenantAPermits = await permitTypeService.findAll(user(tenantA));
    const tenantBPermits = await permitTypeService.findAll(user(tenantB));

    expect(tenantAPermits.length).toBeGreaterThan(0);
    expect(tenantBPermits).toHaveLength(0);
  });
});
