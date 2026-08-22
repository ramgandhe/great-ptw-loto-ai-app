import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
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
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

// Mutable auth context so a single booted app can exercise different users,
// roles, tenants and the unauthenticated case.
let currentUser: AuthenticatedUser | null = null;

function dynamicAuthGuard() {
  return {
    canActivate: (context: ExecutionContext) => {
      if (!currentUser) {
        return false; // simulates JwtAuthGuard rejecting an unauthenticated request
      }
      context.switchToHttp().getRequest().user = currentUser;
      return true;
    },
  };
}

async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JwtAuthGuard)
    .useValue(dynamicAuthGuard())
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

describe('Isolation Execution HTTP integration (PUS-156)', () => {
  let app: INestApplication;
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const tenantId = randomUUID();
  const officerId = randomUUID();

  const officer: AuthenticatedUser = {
    id: officerId,
    username: 'officer',
    tenantId,
    roles: ['operator'],
    email: 'officer@example.com',
  };
  const verifier: AuthenticatedUser = {
    id: randomUUID(),
    username: 'safety-officer',
    tenantId,
    roles: ['safety-officer'],
    email: 'verifier@example.com',
  };
  const reader: AuthenticatedUser = {
    id: randomUUID(),
    username: 'viewer',
    tenantId,
    roles: ['viewer'],
    email: 'viewer@example.com',
  };
  const foreignTenantAdmin: AuthenticatedUser = {
    id: randomUUID(),
    username: 'other-admin',
    tenantId: randomUUID(),
    roles: ['operator', 'org-admin'],
    email: 'other@example.com',
  };
  const noActionRole: AuthenticatedUser = {
    id: randomUUID(),
    username: 'issuer',
    tenantId,
    roles: ['job-issuer'],
    email: 'issuer@example.com',
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      db = drizzle(pool, { schema });
      await migrate(db, { migrationsFolder });
    } catch {
      canConnect = false;
      return;
    }
    app = await createTestApp();
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

  async function seedPlan(planTenantId: string = tenantId) {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId: planTenantId,
        status: 'approved',
        permitTypeId: randomUUID(),
        title: 'Isolation execution permit',
        reference: `PTW-EXE-${randomUUID().slice(0, 8)}`,
        createdBy: officerId,
      })
      .returning();

    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({ tenantId: planTenantId, code: `WS-${randomUUID().slice(0, 6)}`, name: 'Bay', createdBy: officerId })
      .returning();

    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId: planTenantId,
        code: `MC-${randomUUID().slice(0, 6)}`,
        name: 'Compressor',
        workstationId: workstation.id,
        createdBy: officerId,
      })
      .returning();

    const [plan] = await db
      .insert(schema.lototoPlans)
      .values({
        tenantId: planTenantId,
        permitId: permit.id,
        machineryId: machinery.id,
        title: 'Primary isolation plan',
        status: 'ready',
        createdBy: officerId,
      })
      .returning();

    const [point1] = await db
      .insert(schema.isolationPoints)
      .values({ planId: plan.id, machineryId: machinery.id, isolationNumber: 'ISO-1', createdBy: officerId })
      .returning();
    const [point2] = await db
      .insert(schema.isolationPoints)
      .values({ planId: plan.id, machineryId: machinery.id, isolationNumber: 'ISO-2', createdBy: officerId })
      .returning();

    await db.insert(schema.isolationSequences).values([
      { planId: plan.id, isolationPointId: point1.id, sequenceOrder: 1, requiresVerification: true, createdBy: officerId },
      { planId: plan.id, isolationPointId: point2.id, sequenceOrder: 2, requiresVerification: true, createdBy: officerId },
    ]);

    return { planId: plan.id, point1: point1.id, point2: point2.id };
  }

  const server = () => app.getHttpServer();

  // ---------- Positive ----------

  httpTest('full isolation flow: start → lock → tag → isolate → verify → complete (FR-LTO-006..011)', async () => {
    const { planId, point1, point2 } = await seedPlan();

    currentUser = officer;
    const startRes = await request(server())
      .post(`/api/v1/lototo-plans/${planId}/isolation-execution`)
      .send({})
      .expect(201);
    expect(startRes.body.success).toBe(true);
    expect(startRes.body.data.status).toBe('in_progress');
    const executionId = startRes.body.data.id;

    // Locks applied in sequence order (FR-LTO-006/008).
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/locks`)
      .send({ isolationPointId: point1, lockTag: 'LK-1', lockMethod: 'padlock' })
      .expect(201);
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/locks`)
      .send({ isolationPointId: point2, lockTag: 'LK-2', lockMethod: 'padlock' })
      .expect(201);

    // Tag (FR-LTO-008).
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/tags`)
      .send({ isolationPointId: point1, tagNumber: 'TG-1', tagType: 'danger' })
      .expect(201);

    // Isolation complete once all sequenced points locked (FR-LTO-008).
    const isolateRes = await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/isolate`)
      .send({})
      .expect(201);
    expect(isolateRes.body.data.status).toBe('isolated');

    // Verification by a verifier (FR-LTO-007).
    currentUser = verifier;
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/verifications`)
      .send({ isolationPointId: point1, result: 'pass', method: 'try-out' })
      .expect(201);
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/verifications`)
      .send({ isolationPointId: point2, result: 'pass' })
      .expect(201);

    // Complete verification transition.
    currentUser = officer;
    const verifyRes = await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/verify`)
      .send({})
      .expect(201);
    expect(verifyRes.body.data.status).toBe('verified');

    // Evidence metadata (FR-LTO-009).
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/evidence`)
      .send({
        isolationPointId: point1,
        fileName: 'iso.jpg',
        contentType: 'image/jpeg',
        fileSize: 2048,
        storageKey: `evidence/${randomUUID()}.jpg`,
      })
      .expect(201);

    // Read aggregate (authorised reader).
    currentUser = reader;
    const detailRes = await request(server())
      .get(`/api/v1/isolation-executions/${executionId}`)
      .expect(200);
    expect(detailRes.body.data.execution.status).toBe('verified');
    expect(detailRes.body.data.locks).toHaveLength(2);
    expect(detailRes.body.data.tags).toHaveLength(1);
    expect(detailRes.body.data.verifications).toHaveLength(2);
    expect(detailRes.body.data.evidence).toHaveLength(1);
  });

  // ---------- Negative: unauthenticated ----------

  httpTest('rejects unauthenticated access to a protected endpoint', async () => {
    const { planId } = await seedPlan();
    currentUser = null;
    await request(server())
      .post(`/api/v1/lototo-plans/${planId}/isolation-execution`)
      .send({})
      .expect(403);
  });

  // ---------- Negative: RBAC enforced server-side ----------

  httpTest('rejects action by a role without permission (RBAC server-side)', async () => {
    const { planId } = await seedPlan();
    currentUser = noActionRole; // job-issuer cannot start execution
    await request(server())
      .post(`/api/v1/lototo-plans/${planId}/isolation-execution`)
      .send({})
      .expect(403);

    // verifier cannot perform an action-only route either
    currentUser = verifier;
    await request(server())
      .post(`/api/v1/lototo-plans/${planId}/isolation-execution`)
      .send({})
      .expect(403);
  });

  // ---------- Negative: cross-tenant scoping ----------

  httpTest('prevents cross-tenant data access (no leakage)', async () => {
    const { planId, point1 } = await seedPlan();
    currentUser = officer;
    const startRes = await request(server())
      .post(`/api/v1/lototo-plans/${planId}/isolation-execution`)
      .send({})
      .expect(201);
    const executionId = startRes.body.data.id;

    // Foreign tenant (even as admin) must not read or mutate this execution.
    currentUser = foreignTenantAdmin;
    await request(server()).get(`/api/v1/isolation-executions/${executionId}`).expect(404);
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/locks`)
      .send({ isolationPointId: point1, lockTag: 'X', lockMethod: 'padlock' })
      .expect(404);
  });

  // ---------- Negative: invalid state transitions ----------

  httpTest('rejects verify before isolate (invalid transition)', async () => {
    const { planId } = await seedPlan();
    currentUser = officer;
    const startRes = await request(server())
      .post(`/api/v1/lototo-plans/${planId}/isolation-execution`)
      .send({})
      .expect(201);
    const executionId = startRes.body.data.id;

    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/verify`)
      .send({})
      .expect(409);
  });

  httpTest('rejects out-of-sequence lock application (FR-LTO-008)', async () => {
    const { planId, point2 } = await seedPlan();
    currentUser = officer;
    const startRes = await request(server())
      .post(`/api/v1/lototo-plans/${planId}/isolation-execution`)
      .send({})
      .expect(201);
    const executionId = startRes.body.data.id;

    // point2 is sequence order 2; applying it before point1 must be rejected.
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/locks`)
      .send({ isolationPointId: point2, lockTag: 'LK-2', lockMethod: 'padlock' })
      .expect(409);
  });

  httpTest('rejects lock application after execution is verified', async () => {
    const { planId, point1, point2 } = await seedPlan();
    currentUser = officer;
    const startRes = await request(server())
      .post(`/api/v1/lototo-plans/${planId}/isolation-execution`)
      .send({})
      .expect(201);
    const executionId = startRes.body.data.id;

    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/locks`)
      .send({ isolationPointId: point1, lockTag: 'LK-1', lockMethod: 'padlock' })
      .expect(201);
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/locks`)
      .send({ isolationPointId: point2, lockTag: 'LK-2', lockMethod: 'padlock' })
      .expect(201);
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/isolate`)
      .send({})
      .expect(201);
    currentUser = verifier;
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/verifications`)
      .send({ isolationPointId: point1, result: 'pass' })
      .expect(201);
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/verifications`)
      .send({ isolationPointId: point2, result: 'pass' })
      .expect(201);
    currentUser = officer;
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/verify`)
      .send({})
      .expect(201);

    // Now verified — further locks are an invalid transition.
    await request(server())
      .post(`/api/v1/isolation-executions/${executionId}/locks`)
      .send({ isolationPointId: point1, lockTag: 'LK-3', lockMethod: 'padlock' })
      .expect(409);
  });
});
