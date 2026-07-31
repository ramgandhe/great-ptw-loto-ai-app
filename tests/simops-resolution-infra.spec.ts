import { readFileSync } from 'fs';
import { join } from 'path';
import { REQUIRED_ENV_VARS, validateEnv } from '../app/src/config/validate-env';
import {
  SIMOPS_DEFAULT_ESCALATION_TIMEOUT_HOURS,
  SIMOPS_ESCALATION_JOB,
  SIMOPS_RESOLVE_ROLES,
} from '../app/src/modules/simops/simops.constants';
import { SimopsCacheService } from '../app/src/modules/simops/simops-cache.service';
import { SimopsEvidenceService } from '../app/src/modules/simops/simops-evidence.service';
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

describe('Environment validation at startup (PUS-175)', () => {
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

describe('Health endpoint reports dependent services down (PUS-175)', () => {
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

describe('SIMOPS resolution infra services (PUS-175)', () => {
  it('exposes resolve roles for assess/approve routes', () => {
    expect(SIMOPS_RESOLVE_ROLES).toEqual(
      expect.arrayContaining(['supervisor', 'org-admin', 'platform-admin']),
    );
    expect(SIMOPS_ESCALATION_JOB).toBe('simops.escalation');
    expect(SIMOPS_DEFAULT_ESCALATION_TIMEOUT_HOURS).toBe(4);
  });

  it('SimopsCacheService builds approval-queue and history keys', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const delByPattern = jest.fn().mockResolvedValue(undefined);
    const cache = new SimopsCacheService(
      { del, delByPattern } as never,
      { get: () => 300 } as never,
    );

    expect(cache.approvalQueueKey('t1')).toBe('simops:approval-queue:t1');
    expect(cache.historyListKey('t1')).toBe('simops:history:list:t1');
    expect(cache.historyDetailKey('t1', 'c1')).toBe('simops:history:t1:c1');

    await cache.invalidateConflict('t1', 'c1');
    expect(del).toHaveBeenCalledWith('simops:conflict:t1:c1');
    expect(del).toHaveBeenCalledWith('simops:conflicts:list:t1');
    expect(del).toHaveBeenCalledWith('simops:approval-queue:t1');
    expect(del).toHaveBeenCalledWith('simops:history:t1:c1');
    expect(del).toHaveBeenCalledWith('simops:history:list:t1');
  });

  it('SimopsEvidenceService builds tenant-scoped MinIO keys', () => {
    const evidence = new SimopsEvidenceService(
      { getBucket: () => 'ptw-documents' } as never,
      { get: () => 3600 } as never,
    );

    expect(evidence.evidenceKey('t1', 'c1', 'p1', 'photo 1.png')).toBe(
      'simops/t1/conflicts/c1/mitigation/p1/photo_1.png',
    );
    expect(evidence.getBucket()).toBe('ptw-documents');
  });

  it('SimopsJobsService escalation sweep emits Loki event with timeout', async () => {
    const logService = { logEvent: jest.fn() };
    const resolution = { runEscalationSweep: jest.fn().mockResolvedValue({ escalated: 0 }) };
    const jobs = new SimopsJobsService(
      {} as never,
      {} as never,
      {
        get: (key: string) =>
          key === 'simops.escalationTimeoutHoursHigh' ? 4 : undefined,
      } as never,
      logService as never,
      {} as never,
      { get: jest.fn().mockReturnValue(resolution) } as never,
    );

    await jobs.runEscalationSweep();

    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'simops.escalation.sweep',
        metadata: { timeoutHours: 4 },
      }),
    );
    expect(resolution.runEscalationSweep).toHaveBeenCalled();
  });

  it('SimopsLogService emits a Loki-tagged structured event', () => {
    const log = new SimopsLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);

    log.logEvent({ action: 'simops.escalation.sweep', tenantId: 't1' });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        loki: true,
        domain: 'simultaneous-operations',
        action: 'simops.escalation.sweep',
      }),
    );
  });
});

describe('CI / environment parity guardrails (PUS-175)', () => {
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

  it('.env.example documents SIMOPS resolution variables', () => {
    for (const key of REQUIRED_ENV_VARS) {
      expect(envExample).toContain(`${key}=`);
    }
    for (const key of [
      'SIMOPS_CACHE_TTL_SECONDS',
      'SIMOPS_CONFLICT_DETECTION_CRON',
      'SIMOPS_ESCALATION_CRON',
      'SIMOPS_ESCALATION_TIMEOUT_HOURS_HIGH',
      'SIMOPS_EVIDENCE_URL_EXPIRY_SECONDS',
    ]) {
      expect(envExample).toContain(`${key}=`);
    }
  });

  it('docker compose api service supplies the required runtime variables', () => {
    for (const key of ['DATABASE_URL', 'REDIS_HOST', 'MINIO_ENDPOINT', 'KEYCLOAK_URL', 'LOKI_URL']) {
      expect(compose).toContain(key);
    }
  });

  it('documents Conflict Resolution infrastructure and rollback path', () => {
    expect(deployment).toContain('Conflict Resolution infrastructure (SP-04.02)');
    expect(deployment).toContain('simops.escalation');
    expect(deployment).toContain('SIMOPS_ESCALATION_TIMEOUT_HOURS_HIGH');
    expect(deployment).toMatch(/Rollback/i);
  });

  it('does not commit real MinIO credentials (uses env interpolation with dev fallback)', () => {
    expect(compose).toContain('${MINIO_SECRET_KEY:-');
  });
});
