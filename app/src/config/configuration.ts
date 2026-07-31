export default () => ({
  port: parseInt(process.env.API_PORT ?? '4000', 10),
  apiVersion: process.env.API_VERSION ?? 'v1',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'ptw_minio',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'ptw_minio_password',
    bucket: process.env.MINIO_BUCKET ?? 'ptw-documents',
  },
  keycloak: {
    url: process.env.KEYCLOAK_URL ?? 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM ?? 'ptw-platform',
    clientId: process.env.KEYCLOAK_CLIENT_ID ?? 'ptw-api',
  },
  auth: {
    defaultTenantId:
      process.env.DEFAULT_TENANT_ID ?? '00000000-0000-4000-8000-000000000001',
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
    lokiUrl: process.env.LOKI_URL ?? 'http://localhost:3100',
  },
  features: {
    auditLogging: process.env.FEATURE_AUDIT_LOGGING !== 'false',
    rateLimiting: process.env.FEATURE_RATE_LIMITING !== 'false',
  },
  masterData: {
    cacheTtlSeconds: parseInt(process.env.MASTER_DATA_CACHE_TTL_SECONDS ?? '300', 10),
  },
  permit: {
    cacheTtlSeconds: parseInt(process.env.PERMIT_CACHE_TTL_SECONDS ?? '300', 10),
    draftRetentionDays: parseInt(process.env.PERMIT_DRAFT_RETENTION_DAYS ?? '90', 10),
    draftCleanupCron: process.env.PERMIT_DRAFT_CLEANUP_CRON ?? '0 2 * * *',
  },
  approval: {
    cacheTtlSeconds: parseInt(process.env.APPROVAL_CACHE_TTL_SECONDS ?? '300', 10),
    reminderCron: process.env.APPROVAL_REMINDER_CRON ?? '0 8 * * *',
    attachmentUrlExpirySeconds: parseInt(
      process.env.APPROVAL_ATTACHMENT_URL_EXPIRY_SECONDS ?? '3600',
      10,
    ),
  },
  execution: {
    cacheTtlSeconds: parseInt(process.env.EXECUTION_CACHE_TTL_SECONDS ?? '300', 10),
    reminderCron: process.env.EXECUTION_REMINDER_CRON ?? '0 8 * * *',
    evidenceUrlExpirySeconds: parseInt(
      process.env.EXECUTION_EVIDENCE_URL_EXPIRY_SECONDS ?? '3600',
      10,
    ),
  },
  closure: {
    cacheTtlSeconds: parseInt(process.env.CLOSURE_CACHE_TTL_SECONDS ?? '300', 10),
    archiveCron: process.env.CLOSURE_ARCHIVE_CRON ?? '0 3 * * *',
    reportCron: process.env.CLOSURE_REPORT_CRON ?? '0 4 * * 1',
    attachmentUrlExpirySeconds: parseInt(
      process.env.CLOSURE_ATTACHMENT_URL_EXPIRY_SECONDS ?? '3600',
      10,
    ),
  },
  lototo: {
    cacheTtlSeconds: parseInt(process.env.LOTOTO_CACHE_TTL_SECONDS ?? '300', 10),
    planningReminderCron: process.env.LOTOTO_PLANNING_REMINDER_CRON ?? '0 8 * * *',
  },
  isolation: {
    cacheTtlSeconds: parseInt(process.env.ISOLATION_CACHE_TTL_SECONDS ?? '300', 10),
    reminderCron: process.env.ISOLATION_REMINDER_CRON ?? '0 */4 * * *',
    evidenceUrlExpirySeconds: parseInt(
      process.env.ISOLATION_EVIDENCE_URL_EXPIRY_SECONDS ?? '3600',
      10,
    ),
  },
  restoration: {
    cacheTtlSeconds: parseInt(process.env.RESTORATION_CACHE_TTL_SECONDS ?? '300', 10),
    notificationCron: process.env.RESTORATION_NOTIFICATION_CRON ?? '0 */6 * * *',
    evidenceUrlExpirySeconds: parseInt(
      process.env.RESTORATION_EVIDENCE_URL_EXPIRY_SECONDS ?? '3600',
      10,
    ),
  },
  simops: {
    cacheTtlSeconds: parseInt(process.env.SIMOPS_CACHE_TTL_SECONDS ?? '300', 10),
    conflictDetectionCron: process.env.SIMOPS_CONFLICT_DETECTION_CRON ?? '*/5 * * * *',
  },
});
