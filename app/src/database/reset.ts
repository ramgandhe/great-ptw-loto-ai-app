import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

const PTW_TABLES = [
  'audit_history',
  'permit_archive',
  'permit_closures',
  'permit_verifications',
  'permit_evidence',
  'permit_progress',
  'permit_status_history',
  'permit_execution',
  'permit_executions',
  'permit_approvals',
  'approval_history',
  'workflow_assignments',
  'workflow_steps',
  'permit_executors',
  'permit_ppe',
  'permit_hazards',
  'permit_attachments',
  'permit_drafts',
  'permits',
  'import_job_results',
  'import_jobs',
  'safety_checklist_items',
  'safety_checklists',
  'hazard_categories',
  'machinery_catalogue',
  'workstation_catalogue',
  'ppe_catalogue',
  'permit_types',
  'competencies',
  'contractors',
  'employees',
  'agencies',
  'notification_preferences',
  'permit_templates',
  'approval_workflows',
  'locations',
  'departments',
  'plants',
  'organisations',
  'audit_logs',
  'platform_metadata',
];

async function resetPtwSchema(): Promise<void> {
  const pool = new Pool({ connectionString });

  console.log('Resetting PTW schema...');

  for (const table of PTW_TABLES) {
    await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
  }

  await pool.query('DELETE FROM drizzle.__drizzle_migrations');
  console.log('PTW tables dropped and migration history cleared.');

  await pool.end();
}

resetPtwSchema().catch((error) => {
  console.error('Reset failed:', error);
  process.exit(1);
});
