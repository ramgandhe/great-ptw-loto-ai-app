import { Pool } from 'pg';
import { testDatabaseUrl } from './helpers/db';

const describeDb = process.env.SKIP_DB_TESTS === '1' ? describe.skip : describe;

/** Confirms the place migration left every old row reachable on the new tables. */
describeDb('place migration references', () => {
  const pool = new Pool({ connectionString: testDatabaseUrl });

  afterAll(async () => {
    await pool.end();
  });

  it('points plants, machines and issued permits at the new records', async () => {
    const missingSites = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM plants p WHERE NOT EXISTS (SELECT 1 FROM sites s WHERE s.id = p.id)`,
    );
    const missingAssets = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM machinery_catalogue m WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = m.id)`,
    );
    const permitsWithoutSite = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM permits p WHERE p.plant_id IS NOT NULL AND p.site_id IS NULL`,
    );
    const proceduresWithoutAsset = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n
       FROM lototo_procedures lp
       WHERE lp.machinery_id IS NOT NULL
         AND lp.asset_id IS NULL
         AND EXISTS (SELECT 1 FROM assets a WHERE a.id = lp.machinery_id)`,
    );

    expect(missingSites.rows[0].n).toBe(0);
    expect(missingAssets.rows[0].n).toBe(0);
    expect(permitsWithoutSite.rows[0].n).toBe(0);
    expect(proceduresWithoutAsset.rows[0].n).toBe(0);
  });
});
