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

export function validateEnv(
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Logger, 'warn' | 'log'> = new Logger('EnvValidation'),
): string[] {
  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const value = env[key];
    return value === undefined || value === '';
  });

  const isProduction = env.NODE_ENV === 'production';

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (isProduction) {
      throw new Error(message);
    }
    logger.warn(`${message} — using development defaults from configuration.ts`);
  } else {
    logger.log('Environment validation passed');
  }

  return missing;
}
