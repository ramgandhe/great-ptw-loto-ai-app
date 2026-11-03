import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../app/src/app.module';
import { JwtAuthGuard } from '../app/src/common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { QueueService } from '../app/src/infrastructure/queue/queue.service';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';
import { insertAssetTarget } from './helpers/place-fixture';

function authGuardAs(user: AuthenticatedUser) {
  return {
    canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = user;
      return true;
    },
  };
}

async function createTestApp(user: AuthenticatedUser): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(JwtAuthGuard)
    .useValue(authGuardAs(user))
    .overrideProvider(QueueService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
      registerHandler: jest.fn(),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: 'v1', prefix: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

async function buildImportWorkbook(input: {
  code: string;
  title: string;
  assetLabel: string;
  pointCode?: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const header = workbook.addWorksheet('Header');
  header.getCell('A4').value = 'Field';
  header.getCell('B4').value = 'Value';
  const rows: Array<[string, string]> = [
    ['ProcedureCode', input.code],
    ['Title', input.title],
    ['Asset', input.assetLabel],
    ['Purpose', 'Isolate before service'],
    ['Scope', 'Maintenance'],
  ];
  rows.forEach(([field, value], index) => {
    header.getCell(5 + index, 1).value = field;
    header.getCell(5 + index, 2).value = value;
  });

  const points = workbook.addWorksheet('LockoutPoints');
  [
    'SortOrder',
    'PointCode',
    'EnergyType',
    'EnergyOtherText',
    'Magnitude',
    'LocationText',
    'Method',
    'NormalPosition',
    'IsolatedPosition',
    'Action',
    'RestoreAction',
    'Device',
    'Proof',
    'DrawingReference',
    'RemoveOrder',
    'VerificationMethod',
  ].forEach((name, index) => {
    points.getCell(4, index + 1).value = name;
  });
  points.getCell(5, 1).value = 1;
  points.getCell(5, 2).value = input.pointCode ?? 'E-1';
  points.getCell(5, 3).value = 'electrical';
  points.getCell(5, 7).value = 'lock_closed';
  points.getCell(5, 10).value = 'Turn isolator off and lock out';
  points.getCell(5, 11).value = 'Remove lock and restore';
  points.getCell(5, 13).value = 'meter';

  const steps = workbook.addWorksheet('SequenceSteps');
  ['Phase', 'SequenceOrder', 'Title', 'Action', 'InfoText', 'Verification', 'Note', 'Description'].forEach(
    (name, index) => {
      steps.getCell(4, index + 1).value = name;
    },
  );
  steps.getCell(5, 1).value = 'apply';
  steps.getCell(5, 2).value = 1;
  steps.getCell(5, 3).value = 'Notify and isolate';
  steps.getCell(6, 1).value = 'remove';
  steps.getCell(6, 2).value = 1;
  steps.getCell(6, 3).value = 'Restore and notify';

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('LOTOTO procedure Excel import HTTP', () => {
  let adminApp: INestApplication;
  let hodApp: INestApplication;
  let pool: Pool;
  let canConnect = false;
  const tenantId = randomUUID();
  const adminId = randomUUID();

  const adminUser: AuthenticatedUser = {
    id: adminId,
    username: 'admin',
    tenantId,
    roles: ['tenant-admin'],
    email: 'admin@example.com',
  };

  const hodUser: AuthenticatedUser = {
    id: randomUUID(),
    username: 'hod',
    tenantId,
    roles: ['permit-approver'],
    email: 'hod@example.com',
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      const db = drizzle(pool, { schema });
      await migrate(db, { migrationsFolder });
    } catch {
      canConnect = false;
      return;
    }
    adminApp = await createTestApp(adminUser);
    hodApp = await createTestApp(hodUser);
  });

  afterAll(async () => {
    if (adminApp) await adminApp.close();
    if (hodApp) await hodApp.close();
    if (canConnect) await pool.end();
  });

  const httpTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) return;
      await fn();
    });
  };

  async function seedAsset() {
    const db = drizzle(pool, { schema });
    const placed = await insertAssetTarget(db, {
      tenantId,
      createdBy: adminId,
      name: 'Bucket Elevator',
    });
    const [asset] = await db
      .select({ id: schema.assets.id, tag: schema.assets.tag, name: schema.assets.name })
      .from(schema.assets)
      .where(eq(schema.assets.id, placed.assetId));
    return asset;
  }

  httpTest('downloads a tenant Excel template', async () => {
    const res = await request(adminApp.getHttpServer())
      .get('/api/v1/lototo/procedures/import/template')
      .buffer()
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toMatch(
      /permitwiseai_.*_lototo_procedure_template\.xlsx/,
    );
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect((res.body as Buffer).length).toBeGreaterThan(1000);
    // ZIP/XLSX local file header
    expect((res.body as Buffer).subarray(0, 2).toString('binary')).toBe('PK');
  });

  httpTest('imports a new draft, warns on re-upload, then overrides', async () => {
    const asset = await seedAsset();
    const code = `IMP-${randomUUID().slice(0, 8)}`;
    const file = await buildImportWorkbook({
      code,
      title: 'Imported lockout',
      assetLabel: `${asset.tag} — ${asset.name}`,
      pointCode: 'E-1',
    });

    const created = await request(adminApp.getHttpServer())
      .post('/api/v1/lototo/procedures/import')
      .attach('file', file, 'lototo_procedure_template.xlsx')
      .expect(201);

    expect(created.body.data.status).toBe('draft');
    expect(created.body.data.code).toBe(code);
    expect(created.body.data.draftVersion.lockoutPoints[0].pointCode).toBe('E-1');
    expect(created.body.data.draftVersion.sequenceSteps.length).toBeGreaterThanOrEqual(2);

    const conflict = await request(adminApp.getHttpServer())
      .post('/api/v1/lototo/procedures/import')
      .attach('file', file, 'lototo_procedure_template.xlsx')
      .expect(409);
    expect(conflict.body.error.code).toBe('PROCEDURE_IMPORT_OVERRIDE_REQUIRED');
    expect(conflict.body.error.details.confirmOverrideRequired).toBe(true);

    const overriddenFile = await buildImportWorkbook({
      code,
      title: 'Imported lockout updated',
      assetLabel: `${asset.tag} — ${asset.name}`,
      pointCode: 'E-2',
    });

    const overridden = await request(adminApp.getHttpServer())
      .post('/api/v1/lototo/procedures/import')
      .field('confirmOverride', 'true')
      .attach('file', overriddenFile, 'lototo_procedure_template.xlsx')
      .expect(201);

    expect(overridden.body.data.title).toBe('Imported lockout updated');
    expect(overridden.body.data.draftVersion.lockoutPoints[0].pointCode).toBe('E-2');
    expect(overridden.body.data.draftVersion.versionNumber).toBe(1);
  });

  httpTest('override of a published procedure creates/replaces a draft without mutating published', async () => {
    const asset = await seedAsset();
    const code = `PUB-${randomUUID().slice(0, 8)}`;
    const file = await buildImportWorkbook({
      code,
      title: 'Published then revised',
      assetLabel: `${asset.tag} — ${asset.name}`,
      pointCode: 'P-1',
    });

    const created = await request(adminApp.getHttpServer())
      .post('/api/v1/lototo/procedures/import')
      .attach('file', file, 'import.xlsx')
      .expect(201);

    await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/${created.body.data.id}/publish`)
      .expect(201);

    const revisedFile = await buildImportWorkbook({
      code,
      title: 'Published then revised',
      assetLabel: `${asset.tag} — ${asset.name}`,
      pointCode: 'P-2',
    });

    const revised = await request(adminApp.getHttpServer())
      .post('/api/v1/lototo/procedures/import')
      .field('confirmOverride', 'true')
      .attach('file', revisedFile, 'import.xlsx')
      .expect(201);

    expect(revised.body.data.status).toBe('published');
    expect(revised.body.data.publishedVersion.lockoutPoints[0].pointCode).toBe('P-1');
    expect(revised.body.data.draftVersion.versionNumber).toBe(2);
    expect(revised.body.data.draftVersion.lockoutPoints[0].pointCode).toBe('P-2');
  });

  httpTest('rejects permit-approver from template download and import', async () => {
    await request(hodApp.getHttpServer()).get('/api/v1/lototo/procedures/import/template').expect(403);

    const asset = await seedAsset();
    const file = await buildImportWorkbook({
      code: `HOD-${randomUUID().slice(0, 8)}`,
      title: 'Should fail',
      assetLabel: `${asset.tag} — ${asset.name}`,
    });
    await request(hodApp.getHttpServer())
      .post('/api/v1/lototo/procedures/import')
      .attach('file', file, 'import.xlsx')
      .expect(403);
  });
});
