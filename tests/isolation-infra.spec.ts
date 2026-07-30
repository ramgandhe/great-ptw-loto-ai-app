import { readFileSync } from 'fs';
import { join } from 'path';
import { REQUIRED_ENV_VARS, validateEnv } from '../app/src/config/validate-env';
import { IsolationCacheService } from '../app/src/modules/isolation-execution/isolation-cache.service';
import { IsolationLogService } from '../app/src/modules/isolation-execution/isolation-log.service';
import { IsolationJobsService } from '../app/src/modules/isolation-execution/isolation-jobs.service';
import { HealthService } from '../app/src/modules/system/system.service';

const repoRoot = join(__dirname, '..');
const silentLogger = { warn: jest.fn(), log: jest.fn() };

function fullEnv(): NodeJS.ProcessEnv {
  return REQUIRED_ENV_VARS.reduce<NodeJS.ProcessEnv>((acc, key) => {
    acc[key] = 'set';
    return acc;
  }, {});
}

describe('Environment validation at startup (PUS-160)', () => {
  it('passes when all required variables are present', () => {
    expect(validateEnv({ ...fullEnv(), NODE_ENV: 'production' }, silentLogger)).toEqual([]);
  });

  it('aborts a production boot when a required variable is missing', () => {
    const env = fullEnv();
    delete env.DATABASE_URL;
    expect(() => validateEnv({ ...env, NODE_ENV: 'production' }, silentLogger)).toThrow(
      /DATABASE_URL/,
    );
  });

  it('warns (does not throw) in development so local defaults work', () => {
    const warn = jest.fn();
    const missing = validateEnv({ NODE_ENV: 'development' }, { warn, log: jest.fn() });
    expect(missing.length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalled();
  });
});

describe('Health endpoint reports dependent services down (PUS-160)', () => {
  it('marks the service unhealthy when dependencies are unreachable', async () => {
    const health = new HealthService(
      { get: () => undefined } as never, // keycloak.url missing => down
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

describe('Isolation infra services (PUS-160)', () => {
  it('IsolationCacheService builds tenant-scoped keys and invalidates both views', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new IsolationCacheService(
      { del } as never,
      { get: () => 300 } as never,
    );
    expect(cache.detailByExecutionKey('t1', 'e1')).toBe('isolation:detail:t1:e1');
    expect(cache.detailByPlanKey('t1', 'p1')).toBe('isolation:plan:t1:p1');

    await cache.invalidate('t1', 'e1', 'p1');
    expect(del).toHaveBeenCalledWith('isolation:detail:t1:e1');
    expect(del).toHaveBeenCalledWith('isolation:plan:t1:p1');
  });

  it('IsolationLogService emits a Loki-tagged structured event', () => {
    const log = new IsolationLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'isolation.lock.applied', executionId: 'e1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'isolation.lock.applied' }),
    );
  });

  it('IsolationJobsService reminders flag active isolation sessions', async () => {
    const active = [
      { id: 'e1', planId: 'p1', tenantId: 't1', status: 'in_progress' },
      { id: 'e2', planId: 'p2', tenantId: 't1', status: 'isolated' },
    ];
    const db = { select: () => ({ from: () => ({ where: () => Promise.resolve(active) }) }) };
    const logService = { logEvent: jest.fn() };
    const jobs = new IsolationJobsService(
      db as never,
      {} as never,
      { get: () => '0 */4 * * *' } as never,
      logService as never,
    );

    await jobs.sendReminders();
    expect(logService.logEvent).toHaveBeenCalledTimes(2);
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'isolation.reminder', executionId: 'e1' }),
    );
  });
});

describe('CI / environment parity guardrails (PUS-160)', () => {
  const ci = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8');
  const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');

  it('CI pipeline runs lint, migration verification, test and build', () => {
    expect(ci).toMatch(/npm run lint/);
    expect(ci).toMatch(/db:migrate -w api/);
    expect(ci).toMatch(/npm run test/);
    expect(ci).toMatch(/npm run build/);
  });

  it('.env.example documents every startup-required variable (no silent divergence)', () => {
    for (const key of REQUIRED_ENV_VARS) {
      expect(envExample).toContain(`${key}=`);
    }
  });

  it('docker compose api service supplies the required runtime variables', () => {
    for (const key of ['DATABASE_URL', 'REDIS_HOST', 'MINIO_ENDPOINT', 'KEYCLOAK_URL', 'LOKI_URL']) {
      expect(compose).toContain(key);
    }
  });

  it('does not commit real MinIO credentials (uses env interpolation with dev fallback)', () => {
    expect(compose).toContain('${MINIO_SECRET_KEY:-');
  });
});
