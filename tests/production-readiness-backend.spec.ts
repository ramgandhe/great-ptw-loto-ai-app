import { HttpException, HttpStatus } from '@nestjs/common';
import { PLATFORM_VERSION } from '@ptw/shared';
import {
  PRODUCTION_REQUIRED_ENV_VARS,
  REQUIRED_ENV_VARS,
  validateEnv,
} from '../app/src/config/validate-env';
import { HealthController } from '../app/src/modules/system/system.controller';
import { HealthService } from '../app/src/modules/system/system.service';

const silentLogger = { warn: jest.fn(), log: jest.fn() };

function fullProductionEnv(): NodeJS.ProcessEnv {
  const env = REQUIRED_ENV_VARS.reduce<NodeJS.ProcessEnv>((acc, key) => {
    acc[key] = 'set';
    return acc;
  }, {});
  for (const key of PRODUCTION_REQUIRED_ENV_VARS) {
    env[key] = 'set';
  }
  env.DATABASE_URL = 'postgresql://ptw:prod_secret@postgres:5432/ptw_platform';
  env.REDIS_PASSWORD = 'prod-redis-secret';
  env.MINIO_ACCESS_KEY = 'prod-minio-user';
  env.MINIO_SECRET_KEY = 'prod-minio-secret';
  env.CORS_ORIGIN = 'https://ptw.example.com';
  env.NODE_ENV = 'production';
  return env;
}

describe('Production readiness backend (PUS-220)', () => {
  it('passes production env validation with non-default secrets', () => {
    expect(validateEnv(fullProductionEnv(), silentLogger)).toEqual([]);
  });

  it('requires REDIS_PASSWORD and CORS_ORIGIN in production', () => {
    const env = fullProductionEnv();
    delete env.REDIS_PASSWORD;
    expect(() => validateEnv(env, silentLogger)).toThrow(/REDIS_PASSWORD/);

    const env2 = fullProductionEnv();
    delete env2.CORS_ORIGIN;
    expect(() => validateEnv(env2, silentLogger)).toThrow(/CORS_ORIGIN/);
  });

  it('rejects local/dev secret defaults in production', () => {
    const env = fullProductionEnv();
    env.DATABASE_URL = 'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';
    expect(() => validateEnv(env, silentLogger)).toThrow(/Insecure production configuration/);
  });

  it('exposes live and ready probes', async () => {
    const health = new HealthService(
      { get: () => 'http://keycloak:8080' } as never,
      { query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) } as never,
      { ping: jest.fn().mockResolvedValue(true) } as never,
      { isHealthy: jest.fn().mockResolvedValue(true) } as never,
      { isHealthy: jest.fn().mockResolvedValue(true) } as never,
    );

    expect(health.live()).toEqual(
      expect.objectContaining({ status: 'alive', version: PLATFORM_VERSION }),
    );

    const ready = await health.ready();
    expect(ready.status).toBe('ready');
    expect(ready.services.database.status).toBe('up');
    expect(ready.services.redis.status).toBe('up');
  });

  it('returns 503 from ready controller when critical deps are down', async () => {
    const health = new HealthService(
      { get: () => undefined } as never,
      { query: jest.fn().mockRejectedValue(new Error('no db')) } as never,
      { ping: jest.fn().mockResolvedValue(false) } as never,
      { isHealthy: jest.fn().mockResolvedValue(false) } as never,
      { isHealthy: jest.fn().mockResolvedValue(false) } as never,
    );
    const controller = new HealthController(health);

    await expect(controller.ready()).rejects.toBeInstanceOf(HttpException);
    try {
      await controller.ready();
    } catch (error) {
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(httpError.getResponse()).toEqual(
        expect.objectContaining({ status: 'not_ready' }),
      );
    }
  });
});
