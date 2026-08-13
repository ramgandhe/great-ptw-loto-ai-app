import { Logger } from '@nestjs/common';

/**
 * Environment variables required for the platform's infrastructure integrations
 * (Postgres, Redis/BullMQ, MinIO, Keycloak, Loki). Validated at startup so that
 * a misconfigured deployment fails fast in production rather than at first use.
 * In non-production environments a warning is logged instead (local defaults in
 * configuration.ts keep the dev experience working).
 */
export const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'KEYCLOAK_URL',
  'KEYCLOAK_REALM',
  'LOKI_URL',
] as const;

/** Extra vars required only when NODE_ENV=production (SP-08.03). */
export const PRODUCTION_REQUIRED_ENV_VARS = ['CORS_ORIGIN'] as const;

/** Reject known local/dev secrets in production boots. */
const INSECURE_PRODUCTION_PATTERNS: ReadonlyArray<{
  key: string;
  pattern: RegExp;
  hint: string;
}> = [
  {
    key: 'DATABASE_URL',
    pattern: /ptw_dev_password|CHANGE_ME/i,
    hint: 'replace local Postgres credentials',
  },
  {
    key: 'MINIO_ACCESS_KEY',
    pattern: /CHANGE_ME|^ptw_minio$/i,
    hint: 'replace local MinIO access key',
  },
  {
    key: 'MINIO_SECRET_KEY',
    pattern: /CHANGE_ME|ptw_minio_password/i,
    hint: 'replace local MinIO secret key',
  },
];

export function validateEnv(
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Logger, 'warn' | 'log'> = new Logger('EnvValidation'),
): string[] {
  const isProduction = env.NODE_ENV === 'production';
  const required = isProduction
    ? [...REQUIRED_ENV_VARS, ...PRODUCTION_REQUIRED_ENV_VARS]
    : [...REQUIRED_ENV_VARS];

  const missing = required.filter((key) => {
    const value = env[key];
    return value === undefined || value === '';
  });

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn(`${message} — using development defaults from configuration.ts`);
  }

  if (isProduction) {
    const redisPassword =
      env.REDIS_PASSWORD ||
      (() => {
        try {
          return env.REDIS_URL ? new URL(env.REDIS_URL).password : '';
        } catch {
          return '';
        }
      })();
    if (!redisPassword) {
      throw new Error(
        'Insecure production configuration: REDIS_PASSWORD or REDIS_URL password is required',
      );
    }

    const insecure = INSECURE_PRODUCTION_PATTERNS.filter(({ key, pattern }) => {
      const value = env[key] ?? '';
      return pattern.test(value);
    });
    if (insecure.length > 0) {
      throw new Error(
        `Insecure production configuration: ${insecure
          .map((item) => `${item.key} (${item.hint})`)
          .join('; ')}`,
      );
    }
  }

  if (missing.length === 0) {
    logger.log('Environment validation passed');
  }

  return missing;
}
