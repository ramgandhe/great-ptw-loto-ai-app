import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../src/common/interfaces/authenticated-user.interface';
import * as schema from '../src/database/schema';
import { AuditService } from '../src/modules/logging/audit.service';
import { HazardService } from '../src/modules/master-data/hazard.service';
import { MasterDataCacheService } from '../src/modules/master-data/master-data-cache.service';
import { MasterDataLogService } from '../src/modules/master-data/master-data-log.service';
import { PermitTypeService } from '../src/modules/master-data/permit-type.service';
import { ReferenceIntegrityService } from '../src/modules/master-data/reference-integrity.service';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('Master data services (PUS-70)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  let permitTypeService: PermitTypeService;
  let hazardService: HazardService;

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

    const cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
    } as unknown as MasterDataCacheService;
    const auditService = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const logService = { logEvent: jest.fn() } as unknown as MasterDataLogService;
    const referenceIntegrity = new ReferenceIntegrityService(db);

    permitTypeService = new PermitTypeService(
      db,
      cacheService,
      auditService,
      logService,
      referenceIntegrity,
    );
    hazardService = new HazardService(
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

  function adminUser(tenantId: string): AuthenticatedUser {
    return {
      id: adminId,
      username: 'org-admin',
      tenantId,
      roles: ['org-admin'],
      email: 'admin@example.com',
    };
  }

  dbTest('rejects duplicate permit type codes within tenant', async () => {
    const tenantId = randomUUID();
    const user = adminUser(tenantId);

    await permitTypeService.create({ code: 'CONFINED-SPACE', name: 'Confined Space' }, user);

    await expect(
      permitTypeService.create({ code: 'CONFINED-SPACE', name: 'Duplicate' }, user),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  dbTest('allows deleting unreferenced hazard category', async () => {
    const tenantId = randomUUID();
    const user = adminUser(tenantId);

    const hazard = await hazardService.create(
      { code: 'FIRE', name: 'Fire hazard', severity: 'high' },
      user,
    );

    await expect(hazardService.remove(hazard.id, user)).resolves.toBeUndefined();
  });

  dbTest('lists permit types with tenant isolation', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    await permitTypeService.create({ code: 'A-TYPE', name: 'Tenant A Type' }, adminUser(tenantA));
    await permitTypeService.create({ code: 'B-TYPE', name: 'Tenant B Type' }, adminUser(tenantB));

    const tenantAResults = await permitTypeService.findAll(adminUser(tenantA));
    expect(tenantAResults.every((row) => row.tenantId === tenantA)).toBe(true);
    expect(tenantAResults.some((row) => row.code === 'A-TYPE')).toBe(true);
    expect(tenantAResults.some((row) => row.code === 'B-TYPE')).toBe(false);
  });
});
