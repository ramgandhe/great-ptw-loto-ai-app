import { readFileSync } from 'fs';
import { join } from 'path';
import { REQUIRED_ENV_VARS, validateEnv } from '../app/src/config/validate-env';
import { SimopsCacheService } from '../app/src/modules/simops/simops-cache.service';
import { SimopsJobsService } from '../app/src/modules/simops/simops-jobs.service';
import { SimopsLogService } from '../app/src/modules/simops/simops-log.service';
import { HealthService } from '../app/src/modules/system/system.service';

const repoRoot = join(__dirname, '..');
const silentLogger = { warn: jest.fn(), log: jest.fn() };

function fullEnv(): NodeJS.ProcessEnv {
  return REQUIRED_ENV_VARS.reduce<NodeJS.ProcessEnv>((acc, key) => {
    acc[key] = 'set';
    return acc;
  }, {});
}

describe('Environment validation at startup (PUS-170)', () => {
  it('passes when all required variables are present', () => {
    expect(validateEnv({ ...fullEnv(), NODE_ENV: 'production' }, silentLogger)).toEqual([]);
  });

  it('aborts a production boot when a required variable is missing', () => {
    const env = fullEnv();
    delete env.REDIS_HOST;
    expect(() => validateEnv({ ...env, NODE_ENV: 'production' }, silentLogger)).toThrow(
      /REDIS_HOST/,
    );
  });

  it('warns (does not throw) in development so local defaults work', () => {
    const warn = jest.fn();
    const missing = validateEnv({ NODE_ENV: 'development' }, { warn, log: jest.fn() });
    expect(missing.length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalled();
  });
});

describe('Health endpoint reports dependent services down (PUS-170)', () => {
  it('marks the service unhealthy when dependencies are unreachable', async () => {
    const health = new HealthService(
      { get: () => undefined } as never,
      { query: jest.fn().mockRejectedValue(new Error('no db')) } as never,
      { ping: jest.fn().mockResolvedValue(false) } as never,
      { isHealthy: jest.fn().mockResolvedValue(false) } as never,
      { isHealthy: jest.fn().mockResolvedValue(false) } as never,
    );

    const result = await health.check();
    expect(result.services.database.status).toBe('down');
    expect(result.services.redis.status).toBe('down');
    expect(result.services.minio.status).toBe('down');
    expect(result.services.bullmq.status).toBe('down');
    expect(result.status).toBe('unhealthy');
  });
});

describe('SIMOPS infra services (PUS-170)', () => {
  it('SimopsCacheService builds tenant-scoped keys and invalidates conflict views', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const delByPattern = jest.fn().mockResolvedValue(undefined);
    const cache = new SimopsCacheService(
      { del, delByPattern } as never,
      { get: () => 300 } as never,
    );

    expect(cache.activePermitsKey('t1')).toBe('simops:active-permits:t1');
    expect(cache.conflictListKey('t1')).toBe('simops:conflicts:list:t1');
    expect(cache.conflictDetailKey('t1', 'c1')).toBe('simops:conflict:t1:c1');

    await cache.invalidateConflict('t1', 'c1');
    expect(del).toHaveBeenCalledWith('simops:conflict:t1:c1');
    expect(del).toHaveBeenCalledWith('simops:conflicts:list:t1');

    await cache.invalidateTenant('t1');
    expect(delByPattern).toHaveBeenCalledWith('simops:*:t1*');
  });

  it('SimopsLogService emits a Loki-tagged structured event', () => {
    const log = new SimopsLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);

    log.logEvent({ action: 'simops.conflict-detection.sweep', tenantId: 't1' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        loki: true,
        domain: 'simultaneous-operations',
        action: 'simops.conflict-detection.sweep',
      }),
    );
  });

  it('SimopsJobsService sweep caches active permits per tenant', async () => {
    const rows = [
      {
        id: 'p1',
        tenantId: 't1',
        status: 'active',
        locationId: null,
        workstationId: null,
        machineryId: null,
        plannedStartAt: null,
        plannedEndAt: null,
        permitTypeId: 'pt1',
      },
      {
        id: 'p2',
        tenantId: 't1',
        status: 'approved',
        locationId: null,
        workstationId: null,
        machineryId: null,
        plannedStartAt: null,
        plannedEndAt: null,
        permitTypeId: 'pt2',
      },
    ];
    const db = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(rows),
        }),
      }),
    };
    const logService = { logEvent: jest.fn() };
    const cacheService = { setActivePermits: jest.fn().mockResolvedValue(undefined) };
    const detection = { analyseForTenant: jest.fn().mockResolvedValue({ created: 0, skipped: 0 }) };
    const moduleRef = { get: jest.fn().mockReturnValue(detection) };
    const jobs = new SimopsJobsService(
      db as never,
      {} as never,
      { get: () => '*/5 * * * *' } as never,
      logService as never,
      cacheService as never,
      moduleRef as never,
    );

    await jobs.runConflictDetectionSweep();

    expect(cacheService.setActivePermits).toHaveBeenCalledWith('t1', rows);
    expect(detection.analyseForTenant).toHaveBeenCalledWith('t1');
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'simops.conflict-detection.sweep',
        tenantId: 't1',
        metadata: { permitCount: 2 },
      }),
    );
  });
});

describe('CI / environment parity guardrails (PUS-170)', () => {
  const ci = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
  const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
  const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');

  it('CI pipeline runs lint, migration verification, test and build', () => {
    expect(ci).toMatch(/npm run lint/);
    expect(ci).toMatch(/db:migrate -w api/);
    expect(ci).toMatch(/npm run test/);
    expect(ci).toMatch(/npm run build/);
  });

  it('.env.example documents required and SIMOPS variables', () => {
    for (const key of REQUIRED_ENV_VARS) {
      expect(envExample).toContain(`${key}=`);
    }
    for (const key of ['SIMOPS_CACHE_TTL_SECONDS', 'SIMOPS_CONFLICT_DETECTION_CRON']) {
      expect(envExample).toContain(`${key}=`);
    }
  });

  it('docker compose api service supplies the required runtime variables', () => {
    for (const key of ['DATABASE_URL', 'REDIS_HOST', 'MINIO_ENDPOINT', 'KEYCLOAK_URL', 'LOKI_URL']) {
      expect(compose).toContain(key);
    }
  });

  it('documents Conflict Detection infrastructure and rollback path', () => {
    expect(deployment).toContain('Conflict Detection infrastructure (SP-04.01)');
    expect(deployment).toContain('simops.conflict-detection');
    expect(deployment).toMatch(/Rollback/i);
  });

  it('does not commit real MinIO credentials (uses env interpolation with dev fallback)', () => {
    expect(compose).toContain('${MINIO_SECRET_KEY:-');
  });
});
