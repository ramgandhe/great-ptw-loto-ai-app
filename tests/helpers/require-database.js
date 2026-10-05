// Jest global setup. Database specs skip themselves when they cannot connect, which would make a
// run without a database look green. Fail the run instead, unless SKIP_DB_TESTS=1 says so on purpose.
const { Client } = require('pg');

module.exports = async function requireDatabase() {
  if (process.env.SKIP_DB_TESTS === '1') return;
  const url = process.env.DATABASE_URL ?? 'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } catch (error) {
    throw new Error(
      `Database tests need PostgreSQL at ${url.replace(/:[^:@/]+@/, ':***@')} (${error.code ?? error.message}). ` +
        'Start it, set DATABASE_URL, or set SKIP_DB_TESTS=1 to run without the database tests.',
    );
  } finally {
    await client.end().catch(() => undefined);
  }
};
