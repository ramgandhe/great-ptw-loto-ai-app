import { ForbiddenException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { jobContext, runInContext, Tx } from '../app/src/database/context';
import { connectApi, connectOwner, pgErrorCode, platformCtx, userCtx } from './helpers/db';
import { insertLegalEntity, insertNotice, insertOrganisation, insertPerson, makeAdmin } from './helpers/fixtures';
import { keyServiceConfig, services } from './helpers/services';

describe('Personal-data service (NFR-SEC-003, FR-PRV-002, 004, 005, 008)', () => {
  const owner = connectOwner();
  const api = connectApi(6);
  const { consent, personalData } = services();
  let tenant: string;
  let entity: string;
  let otherEntity: string;
  let notice: string;
  let self: string;
  let admin: string;
  let otherAdmin: string;
  let orgAdmin: string;
  let colleague: string;
  let otherEntityColleague: string;

  const ctx = (personId: string) => userCtx(tenant, personId, [entity, otherEntity]);
  const as = <T>(personId: string, fn: (tx: Tx) => Promise<T>) => runInContext(api.db, ctx(personId), fn);
  const give = (personId: string) =>
    as(personId, (tx) => consent.record(tx, ctx(personId), { personId, category: 'blood_group', noticeId: notice, decision: 'given' }));

  beforeAll(async () => {
    tenant = await insertOrganisation(owner);
    entity = await insertLegalEntity(owner, tenant);
    otherEntity = await insertLegalEntity(owner, tenant);
    self = (await insertPerson(owner, tenant, entity)).personId;
    admin = (await insertPerson(owner, tenant, entity)).personId;
    otherAdmin = (await insertPerson(owner, tenant, otherEntity)).personId;
    orgAdmin = (await insertPerson(owner, tenant, entity)).personId;
    colleague = (await insertPerson(owner, tenant, entity)).personId;
    otherEntityColleague = (await insertPerson(owner, tenant, otherEntity)).personId;
    await makeAdmin(owner, { tenantId: tenant, personId: admin, role: 'LEGAL_ORG_ADMIN', legalEntityId: entity });
    await makeAdmin(owner, { tenantId: tenant, personId: otherAdmin, role: 'LEGAL_ORG_ADMIN', legalEntityId: otherEntity });
    await makeAdmin(owner, { tenantId: tenant, personId: orgAdmin, role: 'TENANT_ORG_ADMIN' });
    notice = await insertNotice(owner, tenant, entity, 1);
    await owner.query(`update people set phone = '+91 98000 55555' where id = $1`, [self]);
  });

  afterAll(async () => {
    await owner.end();
    await api.pool.end();
  });

  it('stores encrypted values the person can read back, and logs each view in the same transaction', async () => {
    await as(self, (tx) => personalData.write(tx, ctx(self), self, { emergency_contacts: 'Asha, +91 98000 12345' }));
    const { rows } = await owner.query(`select emergency_contacts from person_private_data where person_id = $1`, [self]);
    expect(rows[0].emergency_contacts.includes(Buffer.from('Asha'))).toBe(false);
    expect(await as(self, (tx) => personalData.read(tx, ctx(self), self, ['emergency_contacts']))).toEqual({
      emergency_contacts: 'Asha, +91 98000 12345',
    });
    const log = await owner.query(
      `select viewer_person_id, purpose, fields from personal_data_access_log where subject_person_id = $1`,
      [self],
    );
    expect(log.rows).toEqual([{ viewer_person_id: self, purpose: 'own_record', fields: ['emergency_contacts'] }]);
  });

  it('refuses blood group until consent is in force, then lets the person and their employer admin enter it (FR-PRV-002)', async () => {
    await expect(as(self, (tx) => personalData.write(tx, ctx(self), self, { blood_group: 'B+' }))).rejects.toBeInstanceOf(ForbiddenException);
    await give(self);
    await as(self, (tx) => personalData.write(tx, ctx(self), self, { blood_group: 'B+' }));
    expect(await as(self, (tx) => personalData.read(tx, ctx(self), self, ['blood_group']))).toEqual({ blood_group: 'B+' });
    // The person's consent, not the admin's, is what lets the admin write.
    await as(admin, (tx) => personalData.write(tx, ctx(admin), self, { blood_group: 'A+' }));
    expect(await as(admin, (tx) => personalData.read(tx, ctx(admin), self, ['blood_group']))).toEqual({ blood_group: 'A+' });
    // FR-AUD-001: each write is audited under the employer legal entity; the admin's on the person's behalf.
    const { rows } = await owner.query(
      `select actor_person_id, legal_entity_id, on_behalf_of_person_id from audit_events
        where action = 'person.sensitive_updated' and entity_id = $1 and changes ? 'blood_group' order by occurred_at`,
      [self],
    );
    expect(rows).toEqual([
      { actor_person_id: self, legal_entity_id: entity, on_behalf_of_person_id: null },
      { actor_person_id: admin, legal_entity_id: entity, on_behalf_of_person_id: self },
    ]);
  });

  it("shows sensitive fields only to the person and the employer's legal-entity admin (FR-PRV-005)", async () => {
    expect(await as(admin, (tx) => personalData.read(tx, ctx(admin), self, ['emergency_contacts']))).toEqual({
      emergency_contacts: 'Asha, +91 98000 12345',
    });
    for (const viewer of [otherAdmin, orgAdmin, colleague, otherEntityColleague]) {
      await expect(as(viewer, (tx) => personalData.read(tx, ctx(viewer), self, ['emergency_contacts']))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });

  it('shows contact details through the logged profile read only, to the same people (FR-PRV-005, 008)', async () => {
    expect(await as(self, (tx) => personalData.readProfile(tx, ctx(self), self))).toMatchObject({ phone: '+91 98000 55555' });
    expect(await as(admin, (tx) => personalData.readProfile(tx, ctx(admin), self))).toMatchObject({ phone: '+91 98000 55555' });
    for (const viewer of [otherAdmin, orgAdmin, colleague, otherEntityColleague]) {
      await expect(as(viewer, (tx) => personalData.readProfile(tx, ctx(viewer), self))).rejects.toBeInstanceOf(ForbiddenException);
    }
    // The assignment card stays readable to colleagues; the contact columns never are.
    expect((await as(otherEntityColleague, (tx) => tx.execute(sql`select full_name, designation from people where id = ${self}`))).rows).toHaveLength(1);
    expect(await pgErrorCode(as(colleague, (tx) => tx.execute(sql`select phone from people where id = ${self}`)))).toBe('42501');
    // Calling the database function directly does not get around the rule either.
    const direct = await as(colleague, (tx) => tx.execute(sql`select email, phone from app_person_contact(${self})`));
    expect(direct.rows).toEqual([]);
    const log = await owner.query(
      `select viewer_person_id, purpose from personal_data_access_log where subject_person_id = $1 and fields = '{email,phone}'::text[] order by viewed_at`,
      [self],
    );
    expect(log.rows).toEqual([
      { viewer_person_id: self, purpose: 'own_record' },
      { viewer_person_id: admin, purpose: 'employer_admin' },
    ]);
  });

  it("the database function refuses a departed person's own call, a job and the platform admin", async () => {
    const contact = (personId: string) => (tx: Tx) => tx.execute(sql`select email, phone from app_person_contact(${personId})`);
    const leaver = (await insertPerson(owner, tenant, entity)).personId;
    expect((await as(leaver, contact(leaver))).rows).toHaveLength(1);
    await owner.query(`update people set status = 'left', left_on = current_date where id = $1`, [leaver]);
    // runInContext accepts the context; the database finds it invalid, so the function returns nothing.
    expect((await as(leaver, contact(leaver))).rows).toEqual([]);
    expect((await runInContext(api.db, jobContext(tenant), contact(self))).rows).toEqual([]);
    expect((await runInContext(api.db, platformCtx, contact(self))).rows).toEqual([]);
  });

  it('returns nothing when the access-log entry cannot be written', async () => {
    // An empty field list violates the log's CHECK, so the log write fails inside the read.
    expect(await pgErrorCode(as(self, (tx) => personalData.read(tx, ctx(self), self, [])))).toBe('23514');
  });

  it('refuses a value copied onto another person', async () => {
    const other = (await insertPerson(owner, tenant, entity)).personId;
    await owner.query(
      `insert into person_private_data (person_id, tenant_id, emergency_contacts)
       select $1, tenant_id, emergency_contacts from person_private_data where person_id = $2`,
      [other, self],
    );
    await expect(as(other, (tx) => personalData.read(tx, ctx(other), other, ['emergency_contacts']))).rejects.toThrow();
  });

  it('stores nothing when the key service is unavailable (Review Focus 3)', async () => {
    const broken = services({ ...keyServiceConfig, 'keyService.url': 'http://localhost:1' });
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await expect(
      as(person, (tx) => broken.personalData.write(tx, ctx(person), person, { emergency_contacts: 'Ravi' })),
    ).rejects.toThrow();
    const { rows } = await owner.query(`select 1 from person_private_data where person_id = $1`, [person]);
    expect(rows).toHaveLength(0);
  });

  it('refuses a health-data write after a same-day withdrawal, even when a form signed that morning is uploaded later', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    await give(person);
    await as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: notice, decision: 'withdrawn' }));
    await as(admin, (tx) =>
      consent.record(tx, ctx(admin), {
        personId: person, category: 'blood_group', noticeId: notice, decision: 'given',
        formFileKey: 'forms/morning.pdf', signedOn: new Date().toISOString().slice(0, 10),
      }),
    );
    await expect(as(admin, (tx) => personalData.write(tx, ctx(admin), person, { blood_group: 'O-' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns no optional contact details once contact consent is withdrawn, but keeps the sign-in identity (D31)', async () => {
    await as(otherAdmin, (tx) =>
      consent.setLawfulBasis(tx, ctx(otherAdmin), { legalEntityId: otherEntity, category: 'contact', purpose: 'Contact', bases: ['consent'], changeReason: 'Counsel advice' }),
    );
    const otherNotice = await insertNotice(owner, tenant, otherEntity, 1);
    const person = (await insertPerson(owner, tenant, otherEntity)).personId;
    await owner.query(`update people set phone = '+91 98000 88888' where id = $1`, [person]);
    const decide = (decision: 'given' | 'withdrawn') =>
      as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'contact', noticeId: otherNotice, decision }));
    await decide('given');
    expect(await as(otherAdmin, (tx) => personalData.readProfile(tx, ctx(otherAdmin), person))).toMatchObject({ phone: '+91 98000 88888' });
    await decide('withdrawn');
    const profile = await as(otherAdmin, (tx) => personalData.readProfile(tx, ctx(otherAdmin), person));
    expect(profile.phone).toBeNull();
    expect(profile.email).toMatch(/@example\.test$/);
  });

  it('never keeps blood group after a withdrawal, whichever of the two commits first (Review Focus 5)', async () => {
    const person = (await insertPerson(owner, tenant, entity)).personId;
    for (let i = 0; i < 5; i++) {
      await give(person);
      const [write, withdraw] = await Promise.allSettled([
        as(admin, (tx) => personalData.write(tx, ctx(admin), person, { blood_group: 'AB-' })),
        as(person, (tx) => consent.record(tx, ctx(person), { personId: person, category: 'blood_group', noticeId: notice, decision: 'withdrawn' })),
      ]);
      expect(withdraw.status).toBe('fulfilled');
      if (write.status === 'rejected') expect(write.reason).toBeInstanceOf(ForbiddenException);
      const { rows } = await owner.query(`select blood_group from person_private_data where person_id = $1`, [person]);
      expect(rows[0]?.blood_group ?? null).toBeNull();
    }
  });
});
