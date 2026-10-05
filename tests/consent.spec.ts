import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getTableColumns } from 'drizzle-orm';
import { DbContext, runInContext, Tx } from '../app/src/database/context';
import { personPrivateData } from '../app/src/database/schema';
import { decisionInForce } from '../app/src/modules/privacy/consent.service';
import { CATEGORY_FIELDS, FIELD_COLUMN } from '../app/src/modules/privacy/sensitive-fields';
import { connectApi, connectOwner, pgErrorCode, userCtx } from './helpers/db';
import {
  assignRole,
  insertDefaultRoles,
  insertLegalEntity,
  insertNotice,
  insertOrganisation,
  insertPerson,
  insertPlant,
  makeAdmin,
} from './helpers/fixtures';
import { services } from './helpers/services';

describe('Lawful basis and consent (FR-PRV-001, 002, 011)', () => {
  const owner = connectOwner();
  const api = connectApi();
  const { consent, permissions } = services();
  let tenant: string;
  let entity: string;
  let otherEntity: string;
  let noticeV1: string;
  let otherEntityNotice: string;
  let datedNotice: string;
  let otherEntityCrew: string;
  let self: string;
  let crewOnly: string;
  let admin: string;
  let otherAdmin: string;
  let colleague: string;

  const ctx = (personId: string): DbContext => userCtx(tenant, personId, [entity, otherEntity]);
  const as = <T>(personId: string, fn: (tx: Tx) => Promise<T>) => runInContext(api.db, ctx(personId), fn);
  const today = () => new Date().toISOString().slice(0, 10);
  const stored = async (personId: string) =>
    (await owner.query(
      `select blood_group is not null as blood, health_conditions is not null as health, emergency_contacts is not null as contacts
         from person_private_data where person_id = $1`,
      [personId],
    )).rows[0];
  const seedPrivate = (personId: string) =>
    owner.query(
      `insert into person_private_data (person_id, tenant_id, blood_group, health_conditions, emergency_contacts)
       values ($1, $2, '\\x01', '\\x02', '\\x03')
       on conflict (person_id) do update set blood_group = '\\x01', health_conditions = '\\x02', emergency_contacts = '\\x03'`,
      [personId, tenant],
    );

  beforeAll(async () => {
    tenant = await insertOrganisation(owner);
    entity = await insertLegalEntity(owner, tenant);
    otherEntity = await insertLegalEntity(owner, tenant);
    self = (await insertPerson(owner, tenant, entity)).personId;
    crewOnly = (await insertPerson(owner, tenant, entity, { accountId: null })).personId;
    admin = (await insertPerson(owner, tenant, entity)).personId;
    otherAdmin = (await insertPerson(owner, tenant, otherEntity)).personId;
    colleague = (await insertPerson(owner, tenant, entity)).personId;
    await makeAdmin(owner, { tenantId: tenant, personId: admin, role: 'LEGAL_ORG_ADMIN', legalEntityId: entity });
    await makeAdmin(owner, { tenantId: tenant, personId: otherAdmin, role: 'LEGAL_ORG_ADMIN', legalEntityId: otherEntity });
    noticeV1 = await insertNotice(owner, tenant, entity, 1);
    otherEntityNotice = await insertNotice(owner, tenant, otherEntity, 1);
    // Published on a fixed past day, so the date-validation tests can name fixed dates before it and after it.
    datedNotice = await insertNotice(owner, tenant, otherEntity, 2);
    await owner.query(`update privacy_notices set published_at = '2026-01-01T00:00:00Z' where id = $1`, [datedNotice]);
    otherEntityCrew = (await insertPerson(owner, tenant, otherEntity, { accountId: null })).personId;
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('uses the platform defaults: blood group and health need consent, emergency contacts never do', async () => {
    const needs = (category: 'blood_group' | 'health_conditions' | 'emergency_contacts' | 'identity') =>
      as(self, (tx) => consent.requiresConsent(tx, entity, category));
    expect(await needs('blood_group')).toBe(true);
    expect(await needs('health_conditions')).toBe(true);
    expect(await needs('emergency_contacts')).toBe(false);
    expect(await needs('identity')).toBe(false);
  });

  it('changes a default only with a recorded reason, and never makes emergency contacts or the sign-in identity depend on consent', async () => {
    const set = (bases: ('consent' | 'employment' | 'vital_interest')[], category: 'health_conditions' | 'emergency_contacts' | 'sign_in', changeReason?: string) =>
      as(admin, (tx) => consent.setLawfulBasis(tx, ctx(admin), { legalEntityId: entity, category, purpose: 'Emergency care', bases, changeReason }));
    await expect(set(['employment'], 'health_conditions')).rejects.toBeInstanceOf(BadRequestException);
    await set(['employment', 'vital_interest'], 'health_conditions', 'Occupational health law, s.12');
    expect(await as(self, (tx) => consent.requiresConsent(tx, entity, 'health_conditions'))).toBe(false);
    await set(['consent'], 'health_conditions');
    expect(await pgErrorCode(set(['consent'], 'emergency_contacts', 'Counsel advice'))).toBe('23514');
    expect(await pgErrorCode(set(['consent'], 'sign_in', 'Counsel advice'))).toBe('23514');
  });

  it("lets only the entity's own legal-entity admin set its lawful bases", async () => {
    for (const actor of [colleague, otherAdmin]) {
      await expect(
        as(actor, (tx) => consent.setLawfulBasis(tx, ctx(actor), { legalEntityId: entity, category: 'contact', purpose: 'Work contact', bases: ['employment'] })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect((await owner.query(`select 1 from lawful_bases where legal_entity_id = $1 and category = 'contact'`, [entity])).rowCount).toBe(0);
  });

  it('records in-app consent against the notice shown, and an admin record only with the signed form and its date', async () => {
    await as(self, (tx) => consent.record(tx, ctx(self), { personId: self, category: 'blood_group', noticeId: noticeV1, decision: 'given' }));
    expect(await as(self, (tx) => consent.hasConsent(tx, self, 'blood_group'))).toBe(true);
    // The decision is audited as a consent record, not a person record: the interim personal-data rule would hide its values.
    const { rows: audited } = await owner.query(`select changes, legal_entity_id, on_behalf_of_person_id from audit_events where entity_type = 'consent' and entity_id = $1 and action = 'consent.given'`, [self]);
    expect(audited).toEqual([
      {
        legal_entity_id: entity,
        on_behalf_of_person_id: null,
        changes: {
          category: { before: null, after: 'blood_group' },
          notice_version: { before: null, after: 1 },
          decided_on: { before: null, after: today() },
        },
      },
    ]);

    const adminRecord = (extra: { formFileKey?: string; signedOn?: string }) =>
      as(admin, (tx) => consent.record(tx, ctx(admin), { personId: crewOnly, category: 'blood_group', noticeId: noticeV1, decision: 'given', ...extra }));
    await expect(adminRecord({ signedOn: today() })).rejects.toBeInstanceOf(BadRequestException);
    await expect(adminRecord({ formFileKey: 'forms/crew-1.pdf' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(adminRecord({ formFileKey: 'forms/crew-1.pdf', signedOn: '2999-01-01' })).rejects.toBeInstanceOf(BadRequestException);
    await adminRecord({ formFileKey: 'forms/crew-1.pdf', signedOn: today() });
    const { rows } = await owner.query(`select method, decided_on::text as decided from consents where person_id = $1`, [crewOnly]);
    expect(rows).toEqual([{ method: 'admin_form', decided: today() }]);
    // FR-AUD-001: an admin's record carries the legal entity and names the person it was recorded for.
    const { rows: adminAudit } = await owner.query(
      `select actor_person_id, legal_entity_id, on_behalf_of_person_id from audit_events where entity_type = 'consent' and entity_id = $1 and action = 'consent.given'`,
      [crewOnly],
    );
    expect(adminAudit).toEqual([{ actor_person_id: admin, legal_entity_id: entity, on_behalf_of_person_id: crewOnly }]);
  });

  it("refuses consent recorded by anyone else, against another entity's notice, or for data that does not rely on consent", async () => {
    for (const actor of [colleague, otherAdmin]) {
      await expect(
        as(actor, (tx) => consent.record(tx, ctx(actor), { personId: self, category: 'blood_group', noticeId: noticeV1, decision: 'given', formFileKey: 'f.pdf', signedOn: today() })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    await expect(
      as(self, (tx) => consent.record(tx, ctx(self), { personId: self, category: 'blood_group', noticeId: otherEntityNotice, decision: 'given' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    for (const category of ['emergency_contacts', 'sign_in'] as const) {
      await expect(
        as(self, (tx) => consent.record(tx, ctx(self), { personId: self, category, noticeId: noticeV1, decision: 'withdrawn' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('finds no person of another tenant to record consent for', async () => {
    const elsewhere = await insertOrganisation(owner);
    const stranger = (await insertPerson(owner, elsewhere, await insertLegalEntity(owner, elsewhere))).personId;
    for (const actor of [self, admin]) {
      await expect(
        as(actor, (tx) => consent.record(tx, ctx(actor), { personId: stranger, category: 'blood_group', noticeId: noticeV1, decision: 'given', formFileKey: 'f.pdf', signedOn: today() })),
      ).rejects.toBeInstanceOf(NotFoundException);
    }
    expect((await owner.query(`select 1 from consents where person_id = $1`, [stranger])).rowCount).toBe(0);
  });

  it('accepts a signed-form date only if it is a real day between the notice publication and today', async () => {
    const signedOn = (date: string) =>
      as(otherAdmin, (tx) =>
        consent.record(tx, ctx(otherAdmin), { personId: otherEntityCrew, category: 'blood_group', noticeId: datedNotice, decision: 'given', formFileKey: 'forms/d.pdf', signedOn: date }),
      );
    // The notice was published on 2026-01-01.
    await expect(signedOn('2025-12-31')).rejects.toBeInstanceOf(BadRequestException); // before publication
    await expect(signedOn('2026-02-31')).rejects.toBeInstanceOf(BadRequestException); // rolls over to March
    await expect(signedOn('2026-02-00')).rejects.toBeInstanceOf(BadRequestException); // no such day
    await expect(signedOn('2026-02-27T10:00')).rejects.toBeInstanceOf(BadRequestException); // not a plain date
    expect((await owner.query(`select 1 from consents where person_id = $1`, [otherEntityCrew])).rowCount).toBe(0);
    await signedOn('2026-02-27');
    expect((await owner.query(`select decided_on::text as decided from consents where person_id = $1`, [otherEntityCrew])).rows).toEqual([{ decided: '2026-02-27' }]);
  });

  it('refuses, in the database, an in-app decision recorded by someone other than the person', async () => {
    const error = await owner
      .query(
        `insert into consents (tenant_id, person_id, category, notice_id, decision, method, decided_on, decided_at, recorded_by_person_id)
         values ($1, $2, 'blood_group', $3, 'given', 'in_app', current_date, now(), $4)`,
        [tenant, self, noticeV1, admin],
      )
      .then(() => undefined, (e: unknown) => e);
    expect(error).toMatchObject({ code: '23514', constraint: 'in_app_consent_is_by_the_person' });
  });

  it('never deletes the sign-in identity, even if asked to (D31)', async () => {
    // Unreachable through record(): the lawful_bases CHECK keeps sign_in off consent. Called directly, as a second line of defence.
    const { personId } = await insertPerson(owner, tenant, entity);
    await expect(
      as(personId, (tx) => consent['deleteDependentData'](tx, ctx(personId), personId, 'sign_in', { legalEntityId: entity })),
    ).rejects.toThrow('sign-in identity');
    expect((await owner.query(`select email is not null as signs_in from people where id = $1`, [personId])).rows).toEqual([{ signs_in: true }]);
  });

  it('keeps the person_private_data columns in step with the fields the categories list', async () => {
    const columns = getTableColumns(personPrivateData);
    const listed = Object.values(CATEGORY_FIELDS).flatMap((fields) => fields.encrypted.map((field) => columns[FIELD_COLUMN[field]].name)).sort();
    const { rows } = await owner.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'person_private_data' and column_name not in ('person_id', 'tenant_id', 'updated_at')`,
    );
    expect(rows.map((row) => row.column_name).sort()).toEqual(listed);
  });

  it('deletes consent-based data at once on every withdrawing decision, and keeps data that does not rely on consent', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    for (const category of ['blood_group', 'health_conditions'] as const) {
      await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category, noticeId: noticeV1, decision: 'given' }));
    }
    await seedPrivate(person);
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'withdrawn' }));
    expect(await stored(person)).toEqual({ blood: false, health: true, contacts: true });
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'health_conditions', noticeId: noticeV1, decision: 'withheld' }));
    expect(await stored(person)).toEqual({ blood: false, health: false, contacts: true });

    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given' }));
    await seedPrivate(person);
    await as(admin, (tx) =>
      consent.record(tx, ctx(admin), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'withdrawn', formFileKey: 'forms/w.pdf', signedOn: today() }),
    );
    expect((await stored(person)).blood).toBe(false);
    // FR-AUD-001: each deletion is audited with the legal entity, and names the person when an admin recorded the withdrawal.
    const { rows: deletions } = await owner.query(
      `select legal_entity_id, on_behalf_of_person_id from audit_events where action = 'person.consent_data_deleted' and entity_id = $1 order by occurred_at`,
      [person],
    );
    expect(deletions).toEqual([
      { legal_entity_id: entity, on_behalf_of_person_id: null },
      { legal_entity_id: entity, on_behalf_of_person_id: null },
      { legal_entity_id: entity, on_behalf_of_person_id: person },
    ]);
  });

  it('keeps the decision date order: an older signed form entered later does not restore withdrawn consent', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'withdrawn' }));
    const lastWeek = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    await owner.query(`update privacy_notices set published_at = now() - interval '30 days' where id = $1`, [noticeV1]);
    await as(admin, (tx) =>
      consent.record(tx, ctx(admin), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given', formFileKey: 'forms/old.pdf', signedOn: lastWeek }),
    );
    expect(await as(person, (tx) => consent.hasConsent(tx, person, 'blood_group'))).toBe(false);
  });

  it('never lets a same-day signed form override a timed decision it cannot be ordered against (R2-SPEC-01)', () => {
    const at = (hhmm: string) => new Date(`2026-10-04T${hhmm}:00Z`);
    // Form signed at 09:00 (time unknown to us), withdrawal in the app at 12:00, form uploaded at 16:00.
    expect(decisionInForce([
      { decision: 'withdrawn', decidedAt: at('12:00'), version: 1 },
      { decision: 'given', decidedAt: null, version: 1 },
    ])?.given).toBe(false);
    // All decisions in the app: the last one counts, so changing one's mind the same day works.
    expect(decisionInForce([
      { decision: 'withdrawn', decidedAt: at('10:00'), version: 1 },
      { decision: 'given', decidedAt: at('12:00'), version: 1 },
    ])?.given).toBe(true);
    expect(decisionInForce([{ decision: 'given', decidedAt: null, version: 1 }])?.given).toBe(true);
    expect(decisionInForce([])).toBeNull();
  });

  it('gives the same answer for two in-app decisions at the same millisecond, in either row order (R3-SPEC-02)', () => {
    const tie = new Date('2026-10-04T12:00:00.123Z');
    const grant = { decision: 'given' as const, decidedAt: tie, version: 1 };
    const withdrawal = { decision: 'withdrawn' as const, decidedAt: tie, version: 1 };
    expect(decisionInForce([grant, withdrawal])?.given).toBe(false);
    expect(decisionInForce([withdrawal, grant])?.given).toBe(false);
    // One millisecond apart, the later decision counts.
    expect(decisionInForce([withdrawal, { ...grant, decidedAt: new Date(tie.getTime() + 1) }])?.given).toBe(true);
    expect(decisionInForce([grant, grant])?.given).toBe(true);
  });

  it('keeps a same-day in-app withdrawal in force when a form signed that morning is uploaded later', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given' }));
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'withdrawn' }));
    await as(admin, (tx) =>
      consent.record(tx, ctx(admin), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given', formFileKey: 'forms/morning.pdf', signedOn: today() }),
    );
    expect(await as(person, (tx) => consent.hasConsent(tx, person, 'blood_group'))).toBe(false);
  });

  it('deletes only optional contact details when a permit-duty holder withdraws contact consent; sign-in, access and duties stay (D31)', async () => {
    await as(otherAdmin, (tx) =>
      consent.setLawfulBasis(tx, ctx(otherAdmin), { legalEntityId: otherEntity, category: 'contact', purpose: 'Contact', bases: ['consent'], changeReason: 'Counsel advice' }),
    );
    const { personId: coordinator, accountId } = await insertPerson(owner, tenant, otherEntity);
    const plant = await insertPlant(owner, tenant, otherEntity);
    const roleIds = await insertDefaultRoles(owner, tenant, otherEntity);
    await assignRole(owner, { tenantId: tenant, personId: coordinator, plantId: plant, legalEntityId: otherEntity, roleId: roleIds.PTW_PERMIT_COORDINATOR });
    await owner.query(`update people set phone = '+91 98000 77777' where id = $1`, [coordinator]);
    const elsewhere = await insertOrganisation(owner);
    const { personId: elsewherePerson } = await insertPerson(owner, elsewhere, await insertLegalEntity(owner, elsewhere), { accountId });
    await owner.query(`update people set phone = '+91 98000 66666' where id = $1`, [elsewherePerson]);
    const decide = (decision: 'given' | 'withdrawn') =>
      as(coordinator, (tx) => consent.record(tx, ctx(coordinator), { personId: coordinator, category: 'contact', noticeId: otherEntityNotice, decision }));
    await decide('given');
    await seedPrivate(coordinator);
    await decide('withdrawn');
    const { rows } = await owner.query(`select id, email is not null as signs_in, phone, account_id from people where id in ($1, $2)`, [coordinator, elsewherePerson]);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId[coordinator]).toMatchObject({ signs_in: true, phone: null, account_id: accountId });
    expect(byId[elsewherePerson]).toMatchObject({ signs_in: true, phone: '+91 98000 66666', account_id: accountId });
    // The context still passes the database's membership check, and the role still grants its permit duties.
    expect(await as(coordinator, (tx) => permissions.holds(tx, coordinator, 'issue_permit', plant, null))).toBe(true);
    expect((await stored(coordinator)).contacts).toBe(true); // emergency contacts rely on employment and vital interest
  });

  it('attributes consent to the wording actually shown or signed, and asks again after new wording (FR-PRV-011)', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'health_conditions', noticeId: noticeV1, decision: 'withheld' }));
    const noticeV2 = await insertNotice(owner, tenant, entity, 2);
    // The screen still showed version 1 when the person tapped "Give consent": recorded under version 1.
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV1, decision: 'given' }));
    const { rows } = await owner.query(
      `select n.version from consents c join privacy_notices n on n.id = c.notice_id where c.person_id = $1 and c.category = 'blood_group'`,
      [person],
    );
    expect(rows).toEqual([{ version: 1 }]);
    expect(await as(person, (tx) => consent.categoriesToAsk(tx, person))).toEqual(['blood_group', 'health_conditions']);
    expect(await as(person, (tx) => consent.hasConsent(tx, person, 'blood_group'))).toBe(true);
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: noticeV2, decision: 'given' }));
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'health_conditions', noticeId: noticeV2, decision: 'withheld' }));
    expect(await as(person, (tx) => consent.categoriesToAsk(tx, person))).toEqual([]);
  });
});
