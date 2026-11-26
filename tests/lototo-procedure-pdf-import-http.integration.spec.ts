jest.mock('../app/src/modules/lototo-pdf-extraction/pdf-document-reader', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  return {
    readLototoPdf: jest.fn(async () => ({
      pages: [{ pageNumber: 1, text: 'Lockout procedure', png }],
      lines: [{ pageNumber: 1, text: 'E-1', centerY: 100 }],
      images: [
        { index: 0, fileName: 'figure-1.png', contentType: 'image/png', bytes: png, pageNumber: 1, centerY: 100, height: 80 },
        { index: 1, fileName: 'figure-2.png', contentType: 'image/png', bytes: png, pageNumber: 1, centerY: 400, height: 80 },
      ],
    })),
  };
});

import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../app/src/app.module';
import { JwtAuthGuard } from '../app/src/common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import * as schema from '../app/src/database/schema';
import { QueueService } from '../app/src/infrastructure/queue/queue.service';
import { StorageService } from '../app/src/infrastructure/storage/storage.service';
import { PROCEDURE_LLM_PROVIDER } from '../app/src/modules/lototo-pdf-extraction/procedure-llm.provider';
import type { LototoPdfLlmDraft } from '../app/src/modules/lototo-pdf-extraction/lototo-pdf-extraction.types';
import { LototoProcedurePdfImportService } from '../app/src/modules/lototo/lototo-procedure-pdf-import.service';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

const samplePdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

class MemoryStorage {
  readonly objects = new Map<string, Buffer>();
  onModuleInit() {}
  onModuleDestroy() {}
  isHealthy() {
    return Promise.resolve(true);
  }
  ensureBucket() {
    return Promise.resolve();
  }
  getBucket() {
    return 'test-bucket';
  }
  getClient() {
    return {};
  }
  async putObject(key: string, body: Buffer) {
    this.objects.set(key, Buffer.from(body));
  }
  async getObject(key: string) {
    const found = this.objects.get(key);
    if (!found) throw new Error(`missing object ${key}`);
    return found;
  }
  async deleteObject(key: string) {
    this.objects.delete(key);
  }
  async presignedGetObject(key: string) {
    return `memory://${key}`;
  }
  async presignedPutObject(key: string) {
    return `memory://${key}`;
  }
}

function authGuardAs(user: AuthenticatedUser) {
  return {
    canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = user;
      return true;
    },
  };
}

function queueStub() {
  return {
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    isHealthy: jest.fn().mockResolvedValue(true),
    registerHandler: jest.fn(),
    getQueue: () => ({
      add: jest.fn().mockResolvedValue({ id: 'job' }),
    }),
  };
}

async function createTestApp(
  user: AuthenticatedUser,
  overrides?: { storage?: MemoryStorage; llm?: { interpret: (input: { imageCount: number }) => Promise<LototoPdfLlmDraft> } },
): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JwtAuthGuard)
    .useValue(authGuardAs(user))
    .overrideProvider(QueueService)
    .useValue(queueStub());
  if (overrides?.storage) builder.overrideProvider(StorageService).useValue(overrides.storage);
  if (overrides?.llm) builder.overrideProvider(PROCEDURE_LLM_PROVIDER).useValue(overrides.llm);
  const moduleRef = await builder.compile();
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

describe('LOTOTO procedure PDF import without a model key', () => {
  let app: INestApplication;
  const previous = {
    lototo: process.env.LOTOTO_PDF_LLM_API_KEY,
    nvidia: process.env.NVIDIA_API_KEY,
  };

  beforeAll(async () => {
    process.env.LOTOTO_PDF_LLM_API_KEY = '';
    process.env.NVIDIA_API_KEY = '';
    app = await createTestApp({
      id: randomUUID(),
      username: 'admin',
      tenantId: randomUUID(),
      roles: ['tenant-admin'],
      email: 'admin@example.com',
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (previous.lototo === undefined) delete process.env.LOTOTO_PDF_LLM_API_KEY;
    else process.env.LOTOTO_PDF_LLM_API_KEY = previous.lototo;
    if (previous.nvidia === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = previous.nvidia;
  });

  it('rejects the upload when the model is not configured', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lototo/procedures/import/pdf')
      .attach('file', samplePdf, 'procedure.pdf')
      .expect(503);
  });
});

describe('LOTOTO procedure PDF import HTTP', () => {
  let adminApp: INestApplication;
  let hodApp: INestApplication;
  let pool: Pool;
  let canConnect = false;
  const storage = new MemoryStorage();
  let interpretCalls = 0;
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

  const llm = {
    interpret: async (input: { imageCount: number }): Promise<LototoPdfLlmDraft> => {
      interpretCalls += 1;
      return {
        code: currentCode,
        title: interpretCalls === 1 ? 'From PDF' : 'From PDF revised',
        assetCode: 'NO-SUCH-TAG',
        lockoutPoints: [{ pointCode: 'E-1', energyType: 'electrical', action: 'Lock out', proof: 'visual' }],
        sequenceSteps: [
          { phase: 'apply', sequenceOrder: 1, title: 'Apply isolation' },
          { phase: 'remove', sequenceOrder: 1, title: 'Remove isolation' },
        ],
        images: input.imageCount > 0 ? [{ index: 0, pointCode: 'E-1' }] : [],
      };
    },
  };
  let currentCode = 'PDF-unset';

  beforeAll(async () => {
    process.env.LOTOTO_PDF_LLM_API_KEY = 'test-key';
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
    adminApp = await createTestApp(adminUser, { storage, llm });
    hodApp = await createTestApp(hodUser, { storage, llm });
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

  async function startImport() {
    const started = await request(adminApp.getHttpServer())
      .post('/api/v1/lototo/procedures/import/pdf')
      .attach('file', samplePdf, 'procedure.pdf')
      .expect(202);
    return started.body.data.jobId as string;
  }

  httpTest('creates an unlinked draft, then resumes the same job on override', async () => {
    interpretCalls = 0;
    currentCode = `PDF-${randomUUID().slice(0, 8)}`;
    const jobId = await startImport();
    await adminApp.get(LototoProcedurePdfImportService).process(jobId);

    const done = await request(adminApp.getHttpServer())
      .get(`/api/v1/lototo/procedures/import/pdf/jobs/${jobId}`)
      .expect(200);
    expect(done.body.data.status).toBe('completed');
    expect(interpretCalls).toBe(1);
    expect(JSON.stringify(done.body.data.warnings)).toContain('NO-SUCH-TAG');
    expect([...storage.objects.keys()].some((key) => key.includes(jobId))).toBe(false);

    const procedure = await request(adminApp.getHttpServer())
      .get(`/api/v1/lototo/procedures/${done.body.data.procedureId}`)
      .expect(200);
    expect(procedure.body.data.code).toBe(currentCode);
    expect(procedure.body.data.title).toBe('From PDF');
    expect(procedure.body.data.assetId).toBeNull();
    expect(procedure.body.data.workLocationId).toBeNull();
    expect(procedure.body.data.draftVersion.lockoutPoints[0].pointCode).toBe('E-1');
    expect(procedure.body.data.draftVersion.lockoutPoints[0].photo?.url).toContain('memory://');
    expect(procedure.body.data.draftVersion.unassignedPhotos).toHaveLength(1);

    const again = await startImport();
    await adminApp.get(LototoProcedurePdfImportService).process(again);
    const paused = await request(adminApp.getHttpServer())
      .get(`/api/v1/lototo/procedures/import/pdf/jobs/${again}`)
      .expect(200);
    expect(paused.body.data.status).toBe('awaiting_override');
    expect(interpretCalls).toBe(2);

    await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/import/pdf/jobs/${again}/confirm-override`)
      .expect(201);
    await adminApp.get(LototoProcedurePdfImportService).process(again);
    expect(interpretCalls).toBe(2);

    const resumed = await request(adminApp.getHttpServer())
      .get(`/api/v1/lototo/procedures/import/pdf/jobs/${again}`)
      .expect(200);
    expect(resumed.body.data.status).toBe('completed');
    expect(resumed.body.data.procedureId).toBe(done.body.data.procedureId);
    const replaced = await request(adminApp.getHttpServer())
      .get(`/api/v1/lototo/procedures/${done.body.data.procedureId}`)
      .expect(200);
    expect(replaced.body.data.title).toBe('From PDF revised');
  });

  httpTest('cancel deletes the temp PDF and stops the job', async () => {
    interpretCalls = 0;
    currentCode = `PDF-${randomUUID().slice(0, 8)}`;
    const jobId = await startImport();
    expect([...storage.objects.keys()].some((key) => key.includes(jobId))).toBe(true);
    const cancelled = await request(adminApp.getHttpServer())
      .post(`/api/v1/lototo/procedures/import/pdf/jobs/${jobId}/cancel`)
      .expect(201);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect([...storage.objects.keys()].some((key) => key.includes(jobId))).toBe(false);
    await adminApp.get(LototoProcedurePdfImportService).process(jobId);
    expect(interpretCalls).toBe(0);
  });

  httpTest('expires an abandoned job and leaves a finished job', async () => {
    const db = drizzle(pool, { schema });
    const abandonedId = randomUUID();
    const finishedId = randomUUID();
    const abandonedKey = `${tenantId}/lototo/pdf-import/${abandonedId}/old.pdf`;
    const finishedKey = `${tenantId}/lototo/pdf-import/${finishedId}/done.pdf`;
    storage.objects.set(abandonedKey, Buffer.from('pdf'));
    storage.objects.set(finishedKey, Buffer.from('pdf'));
    const actor = { id: adminId, username: 'admin', roles: ['tenant-admin'], tenantId };
    await db.insert(schema.lototoProcedurePdfImportJobs).values([
      {
        id: abandonedId,
        tenantId,
        status: 'awaiting_override',
        fileName: 'old.pdf',
        storageBucket: 'test-bucket',
        storageKey: abandonedKey,
        actor,
        expiresAt: new Date(Date.now() - 60_000),
        createdBy: adminId,
        updatedBy: adminId,
      },
      {
        id: finishedId,
        tenantId,
        status: 'completed',
        fileName: 'done.pdf',
        storageBucket: 'test-bucket',
        storageKey: finishedKey,
        actor,
        expiresAt: new Date(Date.now() - 60_000),
        createdBy: adminId,
        updatedBy: adminId,
      },
    ]);

    await adminApp.get(LototoProcedurePdfImportService).cleanupExpired();

    const rows = await db
      .select({ id: schema.lototoProcedurePdfImportJobs.id, status: schema.lototoProcedurePdfImportJobs.status })
      .from(schema.lototoProcedurePdfImportJobs)
      .where(eq(schema.lototoProcedurePdfImportJobs.tenantId, tenantId));
    expect(rows.find((row) => row.id === abandonedId)?.status).toBe('cancelled');
    expect(rows.find((row) => row.id === finishedId)?.status).toBe('completed');
    expect(storage.objects.has(abandonedKey)).toBe(false);
    expect(storage.objects.has(finishedKey)).toBe(true);
  });

  httpTest('rejects a permit approver', async () => {
    await request(hodApp.getHttpServer())
      .post('/api/v1/lototo/procedures/import/pdf')
      .attach('file', samplePdf, 'procedure.pdf')
      .expect(403);
  });
});
