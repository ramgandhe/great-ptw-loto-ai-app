import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { AuditService } from '../app/src/modules/logging/audit.service';
import { UpdatePermitTemplateDto } from '../app/src/modules/organisation/dto/permit-template.dto';
import { OrganisationService } from '../app/src/modules/organisation/organisation.service';
import { REFERENCE_TEMPLATES } from '../app/src/modules/organisation/permit-template-library';
import { testDatabaseUrl } from './helpers/db';

describe('Permit template reference library', () => {
  it('has unique codes and unique field ids within each template', () => {
    expect(new Set(REFERENCE_TEMPLATES.map((t) => t.code)).size).toBe(REFERENCE_TEMPLATES.length);
    for (const template of REFERENCE_TEMPLATES) {
      const ids = template.config.sections.flatMap((s) => s.fields.map((f) => f.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('passes the same validation as an edited template', async () => {
    for (const template of REFERENCE_TEMPLATES) {
      const errors = await validate(plainToInstance(UpdatePermitTemplateDto, { config: template.config }));
      expect(errors).toEqual([]);
    }
  });

  it('rejects unknown field types', async () => {
    const errors = await validate(
      plainToInstance(UpdatePermitTemplateDto, {
        config: { kind: 'check-sheet', sections: [{ id: 's', title: 'S', fields: [{ id: 'f', label: 'F', type: 'photo' }] }] },
      }),
    );
    expect(errors.map((e) => e.property)).toEqual(['config']);
  });
});

describe('Permit templates against the database', () => {
  let pool: Pool;
  let canConnect = false;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    canConnect = await pool.query('SELECT 1').then(() => true, () => false);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('imports the reference set once, links types, duplicates and edits forms', async () => {
    if (!canConnect) return;
    const db = drizzle(pool, { schema });
    const service = new OrganisationService(db as never, { log: jest.fn() } as unknown as AuditService);
    const tenantId = randomUUID();
    const user = { id: randomUUID(), username: 't', tenantId, roles: ['tenant-owner'] };
    const [hotWork, electrical] = await db
      .insert(schema.permitTypes)
      .values([
        { tenantId, code: 'HOT-WORK', name: 'Hot Work' },
        { tenantId, code: 'ELECTRICAL', name: 'Electrical' },
      ])
      .returning();

    try {
      expect(await service.importReferenceTemplates(user)).toEqual({ created: REFERENCE_TEMPLATES.length, alreadyPresent: 0 });
      expect(await service.importReferenceTemplates(user)).toEqual({ created: 0, alreadyPresent: REFERENCE_TEMPLATES.length });

      const templates = await service.listTemplates(user);
      const byCode = new Map(templates.map((t) => [t.code, t]));
      expect(byCode.get('SOP-ES-023-F1')!.permitTypeIds.sort()).toEqual([hotWork.id, electrical.id].sort());
      expect(byCode.get('SOP-ES-023-F4')!.permitTypeIds).toEqual([hotWork.id]);
      expect(byCode.get('SOP-ES-023-F7')!.permitTypeIds).toEqual([]);

      const hot = byCode.get('SOP-ES-023-F4')!;
      const copy = (await service.duplicateTemplate(hot.id, user)) as typeof hot;
      expect(copy).toMatchObject({ code: 'SOP-ES-023-F4-COPY', status: 'draft', name: 'Check sheet: hot work (copy)' });
      expect(copy.config).toEqual(hot.config);
      const second = (await service.duplicateTemplate(hot.id, user)) as typeof hot;
      expect(second.code).toBe('SOP-ES-023-F4-COPY-2');

      const updated = await service.updateTemplate(
        copy.id,
        {
          status: 'published',
          permitTypeIds: [electrical.id],
          config: { kind: 'check-sheet', sections: [{ id: 'a', title: 'Only section', fields: [{ id: 'a-1', label: 'Q', type: 'check' }] }] },
        },
        user,
      );
      expect(updated.permitTypeIds).toEqual([electrical.id]);
      expect((updated.config as { sections: unknown[] }).sections).toHaveLength(1);
      // The original is untouched by edits to its copy.
      expect(((await service.getTemplate(hot.id, user)).config as { sections: unknown[] }).sections.length).toBeGreaterThan(1);

      await expect(service.updateTemplate(copy.id, { permitTypeIds: [randomUUID()] }, user)).rejects.toThrow('permit types');
    } finally {
      await db.delete(schema.permitTemplates).where(eq(schema.permitTemplates.tenantId, tenantId));
      await db.delete(schema.permitTypes).where(eq(schema.permitTypes.tenantId, tenantId));
    }
  });
});
