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

describe('LOTOTO procedure library HTTP', () => {
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
    roles: ['hod'],
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
    if (adminApp) {
      await adminApp.close();
    }
    if (hodApp) {
      await hodApp.close();
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

  async function seedMachinery() {
    const db = drizzle(pool, { schema });
    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({
        tenantId,
        code: `WS-${randomUUID().slice(0, 6)}`,
        name: 'Tower 8',
        createdBy: adminId,
      })
      .returning();
    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: `MC-${randomUUID().slice(0, 6)}`,
        name: 'Bucket Elevator',
        workstationId: workstation.id,
        createdBy: adminId,
      })
      .returning();
    return machinery;
  }

  httpTest('creates, lists by machine, publishes, and snapshots a version', async () => {
    const machinery = await seedMachinery();
    const code = `A-1107-${randomUUID().slice(0, 6)}`;

    const created = await request(adminApp.getHttpServer())
      .post('/api/v1/lototo/procedures')
      .send({
        machineryId: machinery.id,
        code,
        title: 'Bucket Elevator lockout',
        purpose: 'Isolate energy before servicing',
        lockoutPoints: [
          {
            sortOrder: 1,
            pointCode: 'E-1',
            energyType: 'Electrical',
            magnitude: '415 Volts',
            action: 'Turn isolator off and lock',
            device: 'Lock device',
            verificationMethod: 'Verify zero voltage',
          },
        ],
        sequenceSteps: [
          { phase: 'apply', sequenceOrder: 1, title: 'Notify employees' },
          { phase: 'remove', sequenceOrder: 1, title: 'Remove locks' },
        ],
        authorizedRoles: ['operator'],
      })
      .expect(201);

    expect(created.body.data.status).toBe('draft');
    expect(created.body.data.draftVersion.lockoutPoints).toHaveLength(1);

    const listed = await request(adminApp.getHttpServer())
      .get(`/api/v1/lototo/procedures?machineryId=${machinery.id}`)
      .expect(200);
    expect(listed.body.data.some((row: { code: string }) => row.code === code)).toBe(true);

    const published = await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/${created.body.data.id}/publish`)
      .expect(201);
    expect(published.body.data.status).toBe('published');
    expect(published.body.data.publishedVersion.versionNumber).toBe(1);

    const snapshot = await request(adminApp.getHttpServer())
      .get(`/api/v1/lototo/procedure-versions/${published.body.data.publishedVersion.id}`)
      .expect(200);
    expect(snapshot.body.data.lockoutPoints[0].pointCode).toBe('E-1');
  });

  httpTest('creates a revision instead of mutating the published snapshot', async () => {
    const machinery = await seedMachinery();
    const created = await request(adminApp.getHttpServer())
      .post('/api/v1/lototo/procedures')
      .send({
        machineryId: machinery.id,
        code: `REV-${randomUUID().slice(0, 8)}`,
        title: 'Compressor LOTO',
        lockoutPoints: [{ sortOrder: 1, pointCode: 'EMP-1', energyType: 'Electrical' }],
      })
      .expect(201);

    await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/${created.body.data.id}/publish`)
      .expect(201);

    await request(adminApp.getHttpServer())
      .patch(`/api/v1/lototo/procedures/${created.body.data.id}`)
      .send({
        lockoutPoints: [{ sortOrder: 1, pointCode: 'EMP-2', energyType: 'Electrical' }],
      })
      .expect(409);

    const revised = await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/${created.body.data.id}/revisions`)
      .expect(201);
    expect(revised.body.data.draftVersion.versionNumber).toBe(2);
    expect(revised.body.data.publishedVersion.lockoutPoints[0].pointCode).toBe('EMP-1');

    await request(adminApp.getHttpServer())
      .patch(`/api/v1/lototo/procedures/${created.body.data.id}`)
      .send({
        lockoutPoints: [{ sortOrder: 1, pointCode: 'EMP-2', energyType: 'Electrical' }],
      })
      .expect(200);

    const after = await request(adminApp.getHttpServer())
      .get(`/api/v1/lototo/procedures/${created.body.data.id}`)
      .expect(200);
    expect(after.body.data.publishedVersion.lockoutPoints[0].pointCode).toBe('EMP-1');
    expect(after.body.data.draftVersion.lockoutPoints[0].pointCode).toBe('EMP-2');
  });

  httpTest('deactivates a published procedure, hides it from the picker, then reactivates and deletes it', async () => {
    const machinery = await seedMachinery();
    const created = await request(adminApp.getHttpServer())
      .post('/api/v1/lototo/procedures')
      .send({
        machineryId: machinery.id,
        code: `OFF-${randomUUID().slice(0, 8)}`,
        title: 'Idle lockout',
        lockoutPoints: [{ sortOrder: 1, pointCode: 'OFF-1', energyType: 'Electrical' }],
      })
      .expect(201);

    await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/${created.body.data.id}/publish`)
      .expect(201);

    const deactivated = await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/${created.body.data.id}/deactivate`)
      .expect(201);
    expect(deactivated.body.data.status).toBe('inactive');

    const publishedOnly = await request(adminApp.getHttpServer())
      .get(`/api/v1/lototo/procedures?machineryId=${machinery.id}&published=true`)
      .expect(200);
    expect(publishedOnly.body.data).toEqual([]);

    await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/${created.body.data.id}/revisions`)
      .expect(409);

    const reactivated = await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/${created.body.data.id}/reactivate`)
      .expect(201);
    expect(reactivated.body.data.status).toBe('published');

    await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/${created.body.data.id}/deactivate`)
      .expect(201);

    await request(adminApp.getHttpServer())
      .delete(`/api/v1/lototo/procedures/${created.body.data.id}`)
      .expect(200);
  });

  httpTest('rejects HOD creating a library procedure', async () => {
    const machinery = await seedMachinery();
    await request(hodApp.getHttpServer())
      .post('/api/v1/lototo/procedures')
      .send({
        machineryId: machinery.id,
        code: `HOD-${randomUUID().slice(0, 8)}`,
        title: 'Should fail',
      })
      .expect(403);
  });
});
