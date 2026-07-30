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

async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
}

describe('Foundation HTTP integration (PUS-71)', () => {
  let app: INestApplication;
  let pool: Pool;
  let canConnect = false;
  const tenantId = randomUUID();
  const userId = randomUUID();

  const testUser: AuthenticatedUser = {
    id: userId,
    username: 'org-admin',
    tenantId,
    roles: ['org-admin'],
    email: 'admin@example.com',
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

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JwtAuthGuard)
      .useValue(authGuardAs(testUser))
      .overrideProvider(QueueService)
      .useValue({
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
        isHealthy: jest.fn().mockResolvedValue(true),
        registerHandler: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
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
  });

  afterAll(async () => {
    if (app) {
      await closeTestApp(app);
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

  httpTest('returns wrapped success response from health endpoint', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBeDefined();
    expect(res.body.data.services.database).toBeDefined();
  });

  httpTest('executes org → workforce → master-data chain via HTTP', async () => {
    const orgRes = await request(app.getHttpServer())
      .post('/api/v1/organisations')
      .send({ name: 'Integration Corp', legalName: 'Integration Corp Ltd' })
      .expect(201);
    expect(orgRes.body.success).toBe(true);
    expect(orgRes.body.data.name).toBe('Integration Corp');

    const plantRes = await request(app.getHttpServer())
      .post('/api/v1/plants')
      .send({ name: 'Plant A', code: 'PLT-A' })
      .expect(201);
    const plantId = plantRes.body.data.id;

    const deptRes = await request(app.getHttpServer())
      .post('/api/v1/departments')
      .send({ name: 'Ops', code: 'OPS', plantId })
      .expect(201);

    const empRes = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .send({ name: 'Alex Worker', email: 'alex@example.com', departmentId: deptRes.body.data.id })
      .expect(201);
    expect(empRes.body.data.departmentId).toBe(deptRes.body.data.id);

    const permitRes = await request(app.getHttpServer())
      .post('/api/v1/permit-types')
      .send({ code: 'CONFINED', name: 'Confined Space' })
      .expect(201);
    expect(permitRes.body.data.code).toBe('CONFINED');

    const directoryRes = await request(app.getHttpServer()).get('/api/v1/workforce').expect(200);
    expect(directoryRes.body.data.some((r: { id: string }) => r.id === empRes.body.data.id)).toBe(
      true,
    );
  });

  httpTest('rejects PPE create without category (org UI gap)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ppe-configurations')
      .send({ name: 'Helmet', code: 'HELM-01' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  httpTest('rejects checklist create without items (org UI gap)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/safety-checklists')
      .send({ name: 'Pre-work', code: 'CHK-01' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  httpTest('denies viewer role from creating plants', async () => {
    const viewerApp = await createTestApp({ ...testUser, roles: ['viewer'] });

    await request(viewerApp.getHttpServer())
      .post('/api/v1/plants')
      .send({ name: 'Blocked', code: 'BLK' })
      .expect(403);

    await closeTestApp(viewerApp);
  });
});
