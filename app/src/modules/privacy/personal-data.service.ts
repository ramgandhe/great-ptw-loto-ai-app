import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { DbContext, Tx } from '../../database/context';
import { people, personalDataAccessLog, personPrivateData } from '../../database/schema';
import { PermissionService } from '../access/permission.service';
import { AuditWriter } from '../audit/audit-writer';
import { ConsentService } from './consent.service';
import { decryptField, encryptField, keyVersionOf } from './field-crypto';
import { FIELD_CATEGORY, FIELD_COLUMN, type SensitiveField } from './sensitive-fields';
import { TenantKeyService } from './tenant-key.service';

const aad = (personId: string, field: SensitiveField) => `${personId}:${field}`;

type Purpose = 'own_record' | 'employer_admin';

/**
 * The only code that reads personal data: encrypted fields (NFR-SEC-003) and full-record contact details.
 * It checks who may see a record (FR-PRV-005) and logs every view in the same transaction; if the log
 * write fails, nothing is returned (FR-PRV-008). Consent changes go through ConsentService.record.
 */
@Injectable()
export class PersonalDataService {
  constructor(
    private readonly tenantKeys: TenantKeyService,
    private readonly consent: ConsentService,
    private readonly permissions: PermissionService,
    private readonly audit: AuditWriter,
  ) {}

  async read(tx: Tx, ctx: DbContext, personId: string, fields: SensitiveField[]): Promise<Partial<Record<SensitiveField, string>>> {
    const subject = await this.subject(tx, personId, false);
    await this.log(tx, ctx, subject, fields, await this.purpose(tx, ctx, subject));
    const [row] = await tx.select().from(personPrivateData).where(eq(personPrivateData.personId, personId));
    const values: Partial<Record<SensitiveField, string>> = {};
    for (const field of fields) {
      const blob = row?.[FIELD_COLUMN[field]];
      if (!blob) continue;
      const key = await this.tenantKeys.byVersion(tx, subject.tenantId, keyVersionOf(blob));
      values[field] = decryptField(key, blob, aad(personId, field));
    }
    return values;
  }

  /** FR-PRV-005, 008: contact details for the person and their employer's legal-entity admins, logged. */
  async readProfile(tx: Tx, ctx: DbContext, personId: string): Promise<{ email: string | null; phone: string | null }> {
    const subject = await this.subject(tx, personId, false);
    await this.log(tx, ctx, subject, ['email', 'phone'], await this.purpose(tx, ctx, subject));
    const { rows } = await tx.execute<{ email: string | null; phone: string | null }>(
      sql`select email, phone from app_person_contact(${personId})`,
    );
    if (!rows[0]) throw new ForbiddenException("Not allowed to see this person's contact details");
    return rows[0];
  }

  async write(tx: Tx, ctx: DbContext, personId: string, values: Partial<Record<SensitiveField, string | null>>): Promise<void> {
    // The row lock serialises this write with ConsentService.record (Review Focus 5).
    const subject = await this.subject(tx, personId, true);
    await this.purpose(tx, ctx, subject);
    const entries = Object.entries(values) as [SensitiveField, string | null][];
    for (const [field, value] of entries) {
      const category = FIELD_CATEGORY[field];
      if (
        value !== null &&
        (await this.consent.requiresConsent(tx, subject.employerLegalEntityId, category)) &&
        !(await this.consent.hasConsent(tx, personId, category))
      ) {
        throw new ForbiddenException(`Consent for ${field.replace(/_/g, ' ')} is not in force`);
      }
    }
    const { version, key } = await this.tenantKeys.current(tx, subject.tenantId);
    const set = Object.fromEntries(
      entries.map(([field, value]) => [FIELD_COLUMN[field], value === null ? null : encryptField(key, version, value, aad(personId, field))]),
    ) as Partial<typeof personPrivateData.$inferInsert>;
    await tx
      .insert(personPrivateData)
      .values({ personId, tenantId: subject.tenantId, ...set })
      .onConflictDoUpdate({ target: personPrivateData.personId, set: { ...set, updatedAt: new Date() } });
    await this.audit.record(tx, ctx, {
      action: 'person.sensitive_updated',
      entityType: 'person',
      entityId: personId,
      changedFields: entries.map(([field]) => field),
    });
  }

  private async log(tx: Tx, ctx: DbContext, subject: { id: string; tenantId: string }, fields: string[], purpose: Purpose): Promise<void> {
    await tx.insert(personalDataAccessLog).values({
      tenantId: subject.tenantId,
      viewerTenantId: ctx.tenantId as string,
      viewerPersonId: ctx.personId,
      subjectPersonId: subject.id,
      fields,
      purpose,
    });
  }

  private async subject(tx: Tx, personId: string, lock: boolean) {
    const query = tx
      .select({ id: people.id, tenantId: people.tenantId, employerLegalEntityId: people.employerLegalEntityId })
      .from(people)
      .where(eq(people.id, personId));
    const [subject] = lock ? await query.for('update') : await query;
    if (!subject) throw new NotFoundException('Person not found');
    return subject;
  }

  /** FR-PRV-005: the person, or the admins of the person's employer legal entity. Nobody else. */
  private async purpose(tx: Tx, ctx: DbContext, subject: { id: string; employerLegalEntityId: string }): Promise<Purpose> {
    if (ctx.personId === subject.id) return 'own_record';
    if (ctx.personId && (await this.permissions.isLegalEntityAdmin(tx, ctx.personId, subject.employerLegalEntityId))) {
      return 'employer_admin';
    }
    throw new ForbiddenException("Not allowed to see this person's personal data");
  }
}
