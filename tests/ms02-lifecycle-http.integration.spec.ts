import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../app/src/app.module';
import { JwtAuthGuard } from '../app/src/common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { QueueService } from '../app/src/infrastructure/queue/queue.service';
import { StorageService } from '../app/src/infrastructure/storage/storage.service';
import * as schema from '../app/src/database/schema';
import {
  asIntegrationUser,
  createIntegrationAuthGuard,
  setIntegrationUser,
} from './helpers/integration-auth';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(JwtAuthGuard)
    .useValue(createIntegrationAuthGuard())
    .overrideProvider(QueueService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockResolvedValue(true),
      registerHandler: jest.fn(),
    })
    // MinIO is an external dependency (not available in CI); mock it like the
    // queue so the evidence-upload step of the lifecycle exercises the API
    // without a live object store.
    .overrideProvider(StorageService)
    .useValue({
      onModuleInit: jest.fn(),
      getBucket: () => 'ptw-documents',
      ensureBucket: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      presignedGetObject: jest.fn().mockResolvedValue('https://minio.test/object'),
      presignedPutObject: jest.fn().mockResolvedValue('https://minio.test/upload'),
      isHealthy: jest.fn().mockResolvedValue(true),
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

describe('MS-02 lifecycle HTTP integration (PUS-225)', () => {
  let app: INestApplication;
  let pool: Pool;
  let canConnect = false;

  const tenantId = randomUUID();
  const userId = randomUUID();

  const adminUser: AuthenticatedUser = {
    id: userId,
    username: 'org-admin',
    tenantId,
    roles: ['org-admin'],
    email: 'admin@example.com',
  };

  const supervisorUser: AuthenticatedUser = {
    id: randomUUID(),
    username: 'supervisor',
    tenantId,
    roles: ['supervisor'],
    email: 'supervisor@example.com',
  };

  const completeChecklist = {
    workCompleted: true,
    evidenceReviewed: true,
    areaSecured: true,
    hazardsRemoved: true,
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

    app = await createTestApp();
    setIntegrationUser(adminUser);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (canConnect) {
      await pool.end();
    }
  });

  const httpTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) {
        return;
      }
      await fn();
    });
  };

  httpTest('MS-01 foundation endpoints remain available after MS-02 merge', async () => {
    const orgRes = await request(app.getHttpServer())
      .post('/api/v1/organisations')
      .send({ name: `MS02 Org ${randomUUID().slice(0, 8)}`, legalName: 'MS02 Org Ltd' })
      .expect(201);

    expect(orgRes.body.success).toBe(true);

    const hazardsRes = await request(app.getHttpServer()).get('/api/v1/hazards').expect(200);
    expect(hazardsRes.body.success).toBe(true);
    expect(Array.isArray(hazardsRes.body.data)).toBe(true);
  });

  httpTest('full permit lifecycle: create → submit → approve → execute → close', async () => {
    const plantRes = await request(app.getHttpServer())
      .post('/api/v1/plants')
      .send({ name: 'MS02 Plant', code: `P-${randomUUID().slice(0, 6)}` })
      .expect(201);
    const plantId = plantRes.body.data.id;

    const locationRes = await request(app.getHttpServer())
      .post('/api/v1/locations')
      .send({ name: 'Tank farm', code: `LOC-${randomUUID().slice(0, 6)}`, plantId })
      .expect(201);
    const locationId = locationRes.body.data.id;

    const hazardRes = await request(app.getHttpServer())
      .post('/api/v1/hazards')
      .send({
        code: `HZ-${randomUUID().slice(0, 6)}`,
        name: 'Fire hazard',
        severity: 'high',
      })
      .expect(201);
    const hazardCategoryId = hazardRes.body.data.id;

    const ppeRes = await request(app.getHttpServer())
      .post('/api/v1/ppe-configurations')
      .send({
        code: `PPE-${randomUUID().slice(0, 6)}`,
        name: 'Safety helmet',
        category: 'head',
      })
      .expect(201);
    const ppeCatalogueId = ppeRes.body.data.id;

    const permitTypeRes = await request(app.getHttpServer())
      .post('/api/v1/permit-types')
      .send({ code: `HOT-${randomUUID().slice(0, 4)}`, name: 'Hot Work' })
      .expect(201);
    const permitTypeId = permitTypeRes.body.data.id;

    const db = drizzle(pool, { schema });
    await db.insert(schema.workflowSteps).values({
      tenantId,
      permitTypeId,
      stepSequence: 1,
      name: 'Supervisor Approval',
      approverRole: 'supervisor',
      createdBy: userId,
    });

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/permits')
      .send({
        permitTypeId,
        title: 'MS-02 lifecycle integration permit',
        locationId,
        plantId,
        plannedStartAt: '2026-09-01T08:00:00Z',
        plannedEndAt: '2026-09-01T16:00:00Z',
        hazards: [{ hazardCategoryId }],
        ppe: [{ ppeCatalogueId }],
        executors: [{ workforceUserId: userId, isPrimary: true }],
      })
      .expect(201);

    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.permit.status).toBe('draft');
    const permitId = createRes.body.data.permit.id;

    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/submit`)
      .expect(201);
    expect(submitRes.body.data.permit.status).toBe('pending_approval');

    const approveRes = await asIntegrationUser(supervisorUser, () =>
      request(app.getHttpServer())
        .post(`/api/v1/approvals/${permitId}/approve`)
        .send({ comment: 'Approved for MS-02 integration test' })
        .expect(201),
    );
    expect(approveRes.body.data.permit.status).toBe('approved');

    const activateRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/activate`)
      .send({ comment: 'Work started' })
      .expect(201);
    expect(activateRes.body.data.permit.status).toBe('active');

    const progressRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/progress`)
      .send({ summary: 'Initial inspection complete' })
      .expect(201);
    expect(progressRes.body.data.permitId).toBe(permitId);

    const evidenceRes = await request(app.getHttpServer())
      .post(`/api/v1/permits/${permitId}/evidence`)
      .attach('file', Buffer.from('fake-image-bytes'), {
        filename: 'site-photo.jpg',
        contentType: 'image/jpeg',
      })
      .field('comment', 'Site photo');
    expect(evidenceRes.status).toBe(201);
    expect(evidenceRes.body.success).toBe(true);

    const verifyRes = await asIntegrationUser(supervisorUser, () =>
      request(app.getHttpServer())
        .post(`/api/v1/permits/${permitId}/verify`)
        .send({ checklist: completeChecklist, comment: 'Area secured' })
        .expect(201),
    );
    expect(verifyRes.body.data.verification.permitId).toBe(permitId);

    const verificationGetRes = await request(app.getHttpServer())
      .get(`/api/v1/permits/${permitId}/verification`)
      .expect(200);
    expect(verificationGetRes.body.data.permitId).toBe(permitId);

    const closeRes = await asIntegrationUser(supervisorUser, () =>
      request(app.getHttpServer())
        .post(`/api/v1/permits/${permitId}/close`)
        .send({ comment: 'Work complete' })
        .expect(201),
    );
    expect(closeRes.body.data.permit.status).toBe('closed');

    const archiveRes = await request(app.getHttpServer()).get('/api/v1/permits/archive').expect(200);
    expect(
      archiveRes.body.data.some((item: { permit: { id: string } }) => item.permit.id === permitId),
    ).toBe(true);

    const archiveDetailRes = await request(app.getHttpServer())
      .get(`/api/v1/permits/archive/${permitId}`)
      .expect(200);
    expect(archiveDetailRes.body.data.closure).toBeTruthy();
    expect(archiveDetailRes.body.data.verification).toBeTruthy();
    expect(archiveDetailRes.body.data.permit.permitTypeId).toBe(permitTypeId);
  });
});
