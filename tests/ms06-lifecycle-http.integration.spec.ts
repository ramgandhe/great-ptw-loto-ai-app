import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
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

describe('MS-06 lifecycle HTTP integration (ITC-INC-001–010)', () => {
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
    username: 'hod',
    tenantId,
    roles: ['hod'],
    email: 'supervisor@example.com',
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

  async function createActivePermit(server: ReturnType<INestApplication['getHttpServer']>) {
    const plantRes = await request(server)
      .post('/api/v1/plants')
      .send({ name: 'MS06 Plant', code: `P-${randomUUID().slice(0, 6)}` })
      .expect(201);
    const plantId = plantRes.body.data.id;

    const locationRes = await request(server)
      .post('/api/v1/locations')
      .send({ name: 'Process area', code: `LOC-${randomUUID().slice(0, 6)}`, plantId })
      .expect(201);
    const locationId = locationRes.body.data.id;

    const hazardRes = await request(server)
      .post('/api/v1/hazards')
      .send({
        code: `HZ-${randomUUID().slice(0, 6)}`,
        name: 'Chemical exposure',
        severity: 'high',
      })
      .expect(201);
    const hazardCategoryId = hazardRes.body.data.id;

    const ppeRes = await request(server)
      .post('/api/v1/ppe-configurations')
      .send({
        code: `PPE-${randomUUID().slice(0, 6)}`,
        name: 'Respirator',
        category: 'respiratory',
      })
      .expect(201);
    const ppeCatalogueId = ppeRes.body.data.id;

    const permitTypeRes = await request(server)
      .post('/api/v1/permit-types')
      .send({ code: `CW-${randomUUID().slice(0, 4)}`, name: 'Cold Work' })
      .expect(201);
    const permitTypeId = permitTypeRes.body.data.id;

    const db = drizzle(pool, { schema });
    await db.insert(schema.workflowSteps).values({
      tenantId,
      permitTypeId,
      stepSequence: 1,
      name: 'Supervisor Approval',
      approverRole: 'hod',
      createdBy: userId,
    });

    const createRes = await request(server)
      .post('/api/v1/permits')
      .send({
        permitTypeId,
        title: 'MS-06 linked permit',
        locationId,
        plantId,
        plannedStartAt: '2026-09-01T08:00:00Z',
        plannedEndAt: '2026-09-01T16:00:00Z',
        hazards: [{ hazardCategoryId }],
        ppe: [{ ppeCatalogueId }],
        executors: [{ workforceUserId: userId, isPrimary: true }],
      })
      .expect(201);
    const permitId = createRes.body.data.permit.id;

    await request(server).post(`/api/v1/permits/${permitId}/submit`).expect(201);
    await asIntegrationUser(supervisorUser, () =>
      request(server)
        .post(`/api/v1/approvals/${permitId}/approve`)
        .send({ comment: 'Approved for MS-06 integration test' })
        .expect(201),
    );
    await request(server)
      .post(`/api/v1/permits/${permitId}/activate`)
      .send({ comment: 'Work started' })
      .expect(201);

    return { permitId, plantId, locationId };
  }

  httpTest('MS-02 permit endpoints remain available after MS-06 merge', async () => {
    const hazardsRes = await request(app.getHttpServer()).get('/api/v1/hazards').expect(200);
    expect(hazardsRes.body.success).toBe(true);
    expect(Array.isArray(hazardsRes.body.data)).toBe(true);
  });

  httpTest(
    'full incident lifecycle linked to permit: report → investigate → verify → close → archive',
    async () => {
      const server = app.getHttpServer();
      const { permitId, plantId, locationId } = await createActivePermit(server);

      const createRes = await request(server)
        .post('/api/v1/incidents')
        .send({
          incidentType: 'incident',
          title: 'MS-06 lifecycle integration incident',
          description: 'Worker slipped near active permit work area.',
          occurredAt: '2026-09-01T10:30:00Z',
          plantId,
          locationId,
          permitIds: [permitId],
          priority: 'high',
        })
        .expect(201);

      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.incident.status).toBe('draft');
      const incidentId = createRes.body.data.incident.id;
      expect(
        createRes.body.data.permits.some(
          (link: { permitId: string }) => link.permitId === permitId,
        ),
      ).toBe(true);

      const submitRes = await request(server)
        .post(`/api/v1/incidents/${incidentId}/submit`)
        .expect(201);
      expect(submitRes.body.data.incident.status).toBe('open');

      const permitAfterSubmit = await drizzle(pool, { schema })
        .select()
        .from(schema.permits)
        .where(eq(schema.permits.id, permitId))
        .limit(1);
      expect(permitAfterSubmit[0]?.status).toBe('cancelled');

      const evidenceRes = await request(server)
        .post(`/api/v1/incidents/${incidentId}/evidence`)
        .attach('file', Buffer.from('incident-photo-bytes'), {
          filename: 'incident-photo.jpg',
          contentType: 'image/jpeg',
        })
        .field('comment', 'Scene photograph');
      expect(evidenceRes.status).toBe(201);
      expect(evidenceRes.body.success).toBe(true);

      const evidenceListRes = await request(server)
        .get(`/api/v1/incidents/${incidentId}/evidence`)
        .expect(200);
      expect(evidenceListRes.body.data.length).toBeGreaterThan(0);

      const assignRes = await request(server)
        .post(`/api/v1/incidents/${incidentId}/assign`)
        .send({ investigatorId: userId, priority: 'high' })
        .expect(201);
      expect(assignRes.body.data.investigation.status).toBe('assigned');

      const rootCauseRes = await request(server)
        .post(`/api/v1/incidents/${incidentId}/root-cause`)
        .send({
          methodology: '5_why',
          description: 'Wet floor without signage during concurrent permit work.',
          findings: 'Housekeeping gap during active permit execution.',
        })
        .expect(201);
      expect(rootCauseRes.body.success).toBe(true);

      const correctiveRes = await request(server)
        .post(`/api/v1/incidents/${incidentId}/corrective-actions`)
        .send({
          title: 'Install temporary signage',
          description: 'Place wet-floor signs before permit work resumes.',
          ownerId: userId,
          dueDate: '2026-12-31',
        })
        .expect(201);
      const correctiveActionId = correctiveRes.body.data.id;

      await request(server)
        .post(`/api/v1/incidents/${incidentId}/preventive-actions`)
        .send({
          title: 'Update housekeeping checklist',
          ownerId: userId,
          dueDate: '2026-12-31',
        })
        .expect(201);

      const completeRes = await request(server)
        .patch(`/api/v1/corrective-actions/${correctiveActionId}`)
        .send({ status: 'completed' })
        .expect(200);
      expect(completeRes.body.data.status).toBe('completed');

      const investigationRes = await request(server)
        .get(`/api/v1/incidents/${incidentId}/investigation`)
        .expect(200);
      expect(investigationRes.body.data.rootCauses.length).toBeGreaterThan(0);
      expect(
        investigationRes.body.data.correctiveActions.every(
          (action: { status: string }) =>
            action.status === 'completed' || action.status === 'cancelled',
        ),
      ).toBe(true);

      const verifyRes = await request(server)
        .post(`/api/v1/incidents/${incidentId}/verify`)
        .send({
          correctiveActionsConfirmed: true,
          preventiveActionsReviewed: true,
          comments: 'Investigation complete; actions verified.',
        })
        .expect(201);
      expect(verifyRes.body.data.incidentId).toBe(incidentId);

      const detailBeforeClose = await request(server)
        .get(`/api/v1/incidents/${incidentId}`)
        .expect(200);
      expect(detailBeforeClose.body.data.incident.status).toBe('verified');

      const closeRes = await request(server)
        .post(`/api/v1/incidents/${incidentId}/close`)
        .send({ comments: 'Incident formally closed after verification.' })
        .expect(201);
      expect(closeRes.body.data.archived).toBe(true);

      const historyRes = await request(server)
        .get(`/api/v1/incidents/${incidentId}/history`)
        .expect(200);
      expect(historyRes.body.data.verification).toBeTruthy();
      expect(historyRes.body.data.closure).toBeTruthy();
      expect(historyRes.body.data.history.length).toBeGreaterThan(0);

      const archiveRes = await request(server).get('/api/v1/incidents/archive').expect(200);
      expect(
        archiveRes.body.data.some(
          (item: { incidentId: string }) => item.incidentId === incidentId,
        ),
      ).toBe(true);

      const archiveDetailRes = await request(server)
        .get(`/api/v1/incidents/archive/${incidentId}`)
        .expect(200);
      expect(archiveDetailRes.body.data.incidentId).toBe(incidentId);
      expect(archiveDetailRes.body.data.snapshot.incident.status).toBe('closed');
      expect(archiveDetailRes.body.data.snapshot.verification).toBeTruthy();
    },
  );
});
