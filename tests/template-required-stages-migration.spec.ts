import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { REFERENCE_TEMPLATES, type TemplateConfig } from '../app/src/modules/organisation/permit-template-library';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

/** Migration 0052: existing companies' Safe work permit copies get the reference required-at stages. */
describe('Safe work permit required-at stages migration (0052)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  const sql = readFileSync(join(migrationsFolder, '0052_template_required_stages.sql'), 'utf8');

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    db = drizzle(pool, { schema });
    canConnect = await pool.query('SELECT 1').then(() => true, () => false);
    if (canConnect) await migrate(db, { migrationsFolder });
  });

  afterAll(async () => {
    if (canConnect) await pool.end();
  });

  /** The reference form as copies stored it before stages existed. */
  function preStageConfig(): TemplateConfig {
    const reference = REFERENCE_TEMPLATES.find((t) => t.code === 'SOP-ES-023-F1')!.config;
    return {
      ...reference,
      sections: reference.sections.map((s) => ({ ...s, fields: s.fields.map(({ requiredAt: _ignored, ...f }) => f) })),
    };
  }
  const stagesOf = (config: TemplateConfig) =>
    Object.fromEntries(
      config.sections
        .flatMap((s) => s.fields)
        .filter((f) => ['Job issued by', 'HOD of job issuer', 'Job authorised by', 'Job completion accepted by'].includes(f.label))
        .map((f) => [f.label, `${f.required ? 'required' : 'optional'}:${f.requiredAt ?? 'submit'}`]),
    );

  it('updates old copies, leaves un-required fields and other templates alone, and is idempotent', async () => {
    if (!canConnect) return;
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const createdBy = randomUUID();
    const old = preStageConfig();
    const unrequired = preStageConfig();
    unrequired.sections.flatMap((s) => s.fields).find((f) => f.label === 'Job authorised by')!.required = false;

    const rows = await db
      .insert(schema.permitTemplates)
      .values([
        { tenantId, name: 'Safe work permit', code: 'SOP-ES-023-F1', status: 'published', config: old, createdBy },
        { tenantId: otherTenantId, name: 'Safe work permit (site copy)', code: 'SOP-ES-023-F1', status: 'draft', config: unrequired, createdBy },
        { tenantId, name: 'Own form', code: 'OWN-1', status: 'published', config: preStageConfig(), createdBy },
      ] as (typeof schema.permitTemplates.$inferInsert)[])
      .returning({ id: schema.permitTemplates.id });

    await pool.query(sql);
    await pool.query(sql);

    const after = await db
      .select()
      .from(schema.permitTemplates)
      .where(inArray(schema.permitTemplates.id, rows.map((r) => r.id)));
    const byName = (name: string) => stagesOf(after.find((t) => t.name === name)!.config as TemplateConfig);

    expect(byName('Safe work permit')).toEqual({
      'Job issued by': 'required:submit',
      'HOD of job issuer': 'required:approval',
      'Job authorised by': 'required:approval',
      'Job completion accepted by': 'required:closure',
    });
    expect(byName('Safe work permit (site copy)')['Job authorised by']).toBe('optional:submit');
    expect(byName('Own form')['HOD of job issuer']).toBe('required:submit');

    // The hot work check sheet's fire watch, three hours after completion, moves to closure.
    const hotWork = REFERENCE_TEMPLATES.find((t) => t.code === 'SOP-ES-023-F4')!.config;
    const oldHotWork = { ...hotWork, sections: hotWork.sections.map((sec) => ({ ...sec, fields: sec.fields.map(({ requiredAt: _r, ...f }) => f) })) };
    const [hot] = await db
      .insert(schema.permitTemplates)
      .values({ tenantId, name: 'Check sheet: hot work', code: 'SOP-ES-023-F4', status: 'published', config: oldHotWork, createdBy } as typeof schema.permitTemplates.$inferInsert)
      .returning({ id: schema.permitTemplates.id });
    await pool.query(sql);
    const [hotAfter] = await db.select().from(schema.permitTemplates).where(inArray(schema.permitTemplates.id, [hot.id]));
    const fireWatch = (hotAfter.config as TemplateConfig).sections.flatMap((sec) => sec.fields).find((f) => f.label === 'Fire watch: three hours after completion');
    expect(fireWatch?.requiredAt).toBe('closure');

    // Everything else in the form is unchanged.
    const updated = after.find((t) => t.name === 'Safe work permit')!.config as TemplateConfig;
    expect(updated.sections.map((s) => s.fields.length)).toEqual(old.sections.map((s) => s.fields.length));
    expect(updated.sections.flatMap((s) => s.fields).map((f) => f.id)).toEqual(old.sections.flatMap((s) => s.fields).map((f) => f.id));

    // An empty form keeps its config.
    const emptyTenant = randomUUID();
    const [empty] = await db
      .insert(schema.permitTemplates)
      .values({ tenantId: emptyTenant, name: 'Empty copy', code: 'SOP-ES-023-F1', status: 'draft', config: { kind: 'permit', sections: [] }, createdBy } as typeof schema.permitTemplates.$inferInsert)
      .returning({ id: schema.permitTemplates.id });
    await pool.query(sql);
    const [emptyAfter] = await db.select().from(schema.permitTemplates).where(inArray(schema.permitTemplates.id, [empty.id]));
    expect(emptyAfter.config).toEqual({ kind: 'permit', sections: [] });
    await db.delete(schema.permitTemplates).where(inArray(schema.permitTemplates.tenantId, [emptyTenant]));

    await db.delete(schema.permitTemplates).where(inArray(schema.permitTemplates.tenantId, [tenantId, otherTenantId]));
  });
});
