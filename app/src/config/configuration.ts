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
  mdp: {
    cacheTtlSeconds: parseInt(process.env.MDP_CACHE_TTL_SECONDS ?? '300', 10),
    dailyReminderCron: process.env.MDP_DAILY_REMINDER_CRON ?? '0 7 * * *',
    evidenceUrlExpirySeconds: parseInt(
      process.env.MDP_EVIDENCE_URL_EXPIRY_SECONDS ?? '3600',
      10,
    ),
    evidencePrefix: process.env.MDP_EVIDENCE_PREFIX ?? 'mdp/daily-progress',
    revalidationCacheTtlSeconds: parseInt(
      process.env.MDP_REVALIDATION_CACHE_TTL_SECONDS ?? '300',
      10,
    ),
    revalidationReminderCron: process.env.MDP_REVALIDATION_REMINDER_CRON ?? '0 6 * * *',
    extensionExpiryCron: process.env.MDP_EXTENSION_EXPIRY_CRON ?? '0 5 * * *',
  },
  incident: {
    cacheTtlSeconds: parseInt(process.env.INCIDENT_CACHE_TTL_SECONDS ?? '300', 10),
    openReminderCron: process.env.INCIDENT_OPEN_REMINDER_CRON ?? '0 8 * * *',
    evidenceUrlExpirySeconds: parseInt(
      process.env.INCIDENT_EVIDENCE_URL_EXPIRY_SECONDS ?? '3600',
      10,
    ),
    evidencePrefix: process.env.INCIDENT_EVIDENCE_PREFIX ?? 'incidents/evidence',
  },
  investigation: {
    cacheTtlSeconds: parseInt(process.env.INVESTIGATION_CACHE_TTL_SECONDS ?? '300', 10),
    overdueActionCron: process.env.INVESTIGATION_OVERDUE_ACTION_CRON ?? '0 9 * * *',
  },
  incidentClosure: {
    cacheTtlSeconds: parseInt(process.env.INCIDENT_CLOSURE_CACHE_TTL_SECONDS ?? '300', 10),
    closureNotifyCron: process.env.INCIDENT_CLOSURE_NOTIFY_CRON ?? '0 10 * * *',
  },
  notification: {
    cacheTtlSeconds: parseInt(process.env.NOTIFICATION_CACHE_TTL_SECONDS ?? '300', 10),
    deliveryRetryCron: process.env.NOTIFICATION_DELIVERY_RETRY_CRON ?? '*/5 * * * *',
    taskReminderCron: process.env.NOTIFICATION_TASK_REMINDER_CRON ?? '0 7 * * *',
  },
  dashboard: {
    cacheTtlSeconds: parseInt(process.env.DASHBOARD_CACHE_TTL_SECONDS ?? '120', 10),
    reportGenerateCron: process.env.DASHBOARD_REPORT_GENERATE_CRON ?? '*/10 * * * *',
    analyticsSnapshotCron: process.env.DASHBOARD_ANALYTICS_SNAPSHOT_CRON ?? '0 1 * * *',
    kpiRefreshCron: process.env.DASHBOARD_KPI_REFRESH_CRON ?? '*/15 * * * *',
    reportPrefix: process.env.DASHBOARD_REPORT_PREFIX ?? 'dashboards/reports',
    metabaseUrl: process.env.METABASE_URL ?? '',
  },
  billing: {
    cacheTtlSeconds: parseInt(process.env.BILLING_CACHE_TTL_SECONDS ?? '300', 10),
    cycleInvoiceCron: process.env.BILLING_CYCLE_INVOICE_CRON ?? '0 2 * * *',
    usageAggregateCron: process.env.BILLING_USAGE_AGGREGATE_CRON ?? '0 * * * *',
    renewalNotifyCron: process.env.BILLING_RENEWAL_NOTIFY_CRON ?? '0 9 * * *',
    renewalHorizonDays: parseInt(process.env.BILLING_RENEWAL_HORIZON_DAYS ?? '7', 10),
  },
});
