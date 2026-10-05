import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DATA_CATEGORIES, DEFAULT_LAWFUL_BASES, type DataCategory, type LawfulBasis } from '@ptw/shared';
import type { DbContext, Tx } from '../../database/context';
import { consents, lawfulBases, legalEntities, people, personPrivateData, privacyNotices } from '../../database/schema';
import { PermissionService } from '../access/permission.service';
import { AuditWriter, type AuditEvent } from '../audit/audit-writer';
import { CATEGORY_FIELDS, FIELD_COLUMN } from './sensitive-fields';

/** A real `YYYY-MM-DD` day: `2026-02-31` rolls over to March in JS and `2026-10-00` is invalid, so both fail the round trip. */
const isCalendarDate = (s: string): boolean => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** The calendar day (`YYYY-MM-DD`) of an instant in a time zone. An unknown time zone throws (RangeError). */
export const localDate = (at: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

type Decision = { decision: 'given' | 'withheld' | 'withdrawn'; decidedAt: Date | null; version: number };

/**
 * The decision in force, from the decisions made on the latest decision date. Only decisions that cannot be
 * ordered against each other decide, and consent is in force only if all of them are "given":
 * - a day with a signed form (date only, no time): every decision that day decides;
 * - otherwise: the decisions at the day's latest instant decide (usually one; two at the same millisecond tie).
 * A same-day withdrawal therefore always wins against a form or a tie, whatever the row order. Server receipt
 * time is never used as the order of the person's decisions (FR-PRV-002).
 */
export function decisionInForce(day: Decision[]): { given: boolean; version: number } | null {
  if (day.length === 0) return null;
  const untimed = day.some((d) => d.decidedAt === null);
  const latest = untimed ? 0 : Math.max(...day.map((d) => (d.decidedAt as Date).getTime()));
  const deciding = untimed ? day : day.filter((d) => (d.decidedAt as Date).getTime() === latest);
  return { given: deciding.every((d) => d.decision === 'given'), version: Math.min(...deciding.map((d) => d.version)) };
}

@Injectable()
export class ConsentService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly audit: AuditWriter,
  ) {}

  /** FR-PRV-001: purpose and lawful basis per category. Changing a platform default needs a recorded reason. */
  async setLawfulBasis(
    tx: Tx,
    ctx: DbContext,
    input: { legalEntityId: string; category: DataCategory; purpose: string; bases: LawfulBasis[]; changeReason?: string },
  ): Promise<void> {
    await this.requireLegalEntityAdmin(tx, ctx, input.legalEntityId);
    const platformDefault = DEFAULT_LAWFUL_BASES[input.category];
    const differs = platformDefault !== undefined && [...platformDefault].sort().join() !== [...input.bases].sort().join();
    if (differs && !input.changeReason?.trim()) {
      throw new BadRequestException('Record the legal reason before changing the platform default');
    }
    const [before] = await tx
      .select()
      .from(lawfulBases)
      .where(and(eq(lawfulBases.legalEntityId, input.legalEntityId), eq(lawfulBases.category, input.category)));
    const values = {
      tenantId: ctx.tenantId as string,
      legalEntityId: input.legalEntityId,
      category: input.category,
      purpose: input.purpose,
      bases: input.bases,
      changeReason: input.changeReason ?? null,
      updatedByPersonId: ctx.personId as string,
      updatedAt: new Date(),
    };
    await tx.insert(lawfulBases).values(values).onConflictDoUpdate({ target: [lawfulBases.legalEntityId, lawfulBases.category], set: values });
    // FR-PRV-002: data kept under a basis that now becomes consent may stay only for people whose consent is in force.
    // People are locked in id order, each before its data, as record and PersonalDataService.write do: no deadlock.
    if (input.bases.includes('consent') && !before?.bases.includes('consent')) {
      const staff = await tx
        .select({ id: people.id })
        .from(people)
        .where(eq(people.employerLegalEntityId, input.legalEntityId))
        .orderBy(people.id)
        .for('no key update');
      for (const { id } of staff) {
        if (!(await this.hasConsent(tx, id, input.category))) {
          await this.deleteDependentData(tx, ctx, id, input.category, { legalEntityId: input.legalEntityId });
        }
      }
    }
    await this.audit.record(tx, ctx, {
      action: 'lawful_basis.set',
      entityType: 'lawful_basis',
      legalEntityId: input.legalEntityId,
      before: before ? { category: before.category, purpose: before.purpose, bases: before.bases } : {},
      after: { category: input.category, purpose: input.purpose, bases: input.bases, change_reason: input.changeReason ?? null },
    });
  }

  async requiresConsent(tx: Tx, legalEntityId: string, category: DataCategory): Promise<boolean> {
    const [row] = await tx
      .select({ bases: lawfulBases.bases })
      .from(lawfulBases)
      .where(and(eq(lawfulBases.legalEntityId, legalEntityId), eq(lawfulBases.category, category)));
    return (row?.bases ?? DEFAULT_LAWFUL_BASES[category] ?? []).includes('consent');
  }

  /**
   * FR-PRV-002, the only consent operation. Recorded by the person in the app against the notice they were
   * shown, or by their employer's admin from the signed form (wording version, signature date, file). Any
   * decision that leaves consent not in force deletes the data that relies on it, in this transaction.
   * The person row is locked (FOR NO KEY UPDATE), so this serialises with PersonalDataService.write and
   * setLawfulBasis without blocking foreign-key checks that reference the person.
   */
  async record(
    tx: Tx,
    ctx: DbContext,
    input: {
      personId: string;
      category: DataCategory;
      noticeId: string;
      decision: 'given' | 'withheld' | 'withdrawn';
      signedOn?: string;
      formFileKey?: string;
    },
  ): Promise<void> {
    const [subject] = await tx
      .select({ id: people.id, tenantId: people.tenantId, employerLegalEntityId: people.employerLegalEntityId })
      .from(people)
      .where(eq(people.id, input.personId))
      .for('no key update');
    if (!subject) throw new NotFoundException('Person not found');
    const self = ctx.personId === subject.id;
    if (!self) await this.requireLegalEntityAdmin(tx, ctx, subject.employerLegalEntityId);
    if (!(await this.requiresConsent(tx, subject.employerLegalEntityId, input.category))) {
      throw new BadRequestException(`${input.category.replace(/_/g, ' ')} does not rely on consent`);
    }
    const [notice] = await tx
      .select({ id: privacyNotices.id, version: privacyNotices.version, legalEntityId: privacyNotices.legalEntityId, publishedAt: privacyNotices.publishedAt })
      .from(privacyNotices)
      .where(eq(privacyNotices.id, input.noticeId));
    if (!notice || notice.legalEntityId !== subject.employerLegalEntityId) {
      throw new BadRequestException("That privacy notice is not the employer's");
    }
    // Decision dates are the employer's local days, the calendar a signed form carries; decided_at stays the instant.
    const [employer] = await tx
      .select({ timeZone: legalEntities.timeZone })
      .from(legalEntities)
      .where(eq(legalEntities.id, subject.employerLegalEntityId));
    const now = new Date();
    const today = localDate(now, employer.timeZone);
    let decidedOn = today;
    if (!self) {
      if (!input.formFileKey) throw new BadRequestException('Attach the signed consent form');
      if (!input.signedOn || !isCalendarDate(input.signedOn)) throw new BadRequestException('Give the date the form was signed');
      if (input.signedOn > today || input.signedOn < localDate(notice.publishedAt, employer.timeZone)) {
        throw new BadRequestException('The signature date must be between the notice publication and today');
      }
      decidedOn = input.signedOn;
    }
    await tx.insert(consents).values({
      tenantId: subject.tenantId,
      personId: subject.id,
      category: input.category,
      noticeId: notice.id,
      decision: input.decision,
      method: self ? 'in_app' : 'admin_form',
      formFileKey: self ? null : (input.formFileKey ?? null),
      decidedOn,
      decidedAt: self ? now : null,
      recordedByPersonId: ctx.personId as string,
    });
    // FR-AUD-001: the audit context. An admin records on the person's behalf.
    const auditContext = { legalEntityId: subject.employerLegalEntityId, ...(self ? {} : { onBehalfOfPersonId: subject.id }) };
    await this.audit.record(tx, ctx, {
      ...auditContext,
      action: `consent.${input.decision}`,
      entityType: 'consent',
      entityId: subject.id,
      after: { category: input.category, notice_version: notice.version, decided_on: decidedOn },
    });
    if (!(await this.hasConsent(tx, subject.id, input.category))) {
      await this.deleteDependentData(tx, ctx, subject.id, input.category, auditContext);
      // Telling the employer's admin (FR-PRV-002) arrives with notifications in Phase 2.
    }
  }

  async hasConsent(tx: Tx, personId: string, category: DataCategory): Promise<boolean> {
    return decisionInForce(await this.latestDay(tx, personId, category))?.given ?? false;
  }

  /** FR-PRV-011: consent categories whose decision in force was made under older wording (or never made). */
  async categoriesToAsk(tx: Tx, personId: string): Promise<DataCategory[]> {
    const [subject] = await tx
      .select({ employerLegalEntityId: people.employerLegalEntityId })
      .from(people)
      .where(eq(people.id, personId));
    if (!subject) throw new NotFoundException('Person not found');
    const [notice] = await tx
      .select({ version: privacyNotices.version })
      .from(privacyNotices)
      .where(eq(privacyNotices.legalEntityId, subject.employerLegalEntityId))
      .orderBy(desc(privacyNotices.version))
      .limit(1);
    if (!notice) return [];
    const ask: DataCategory[] = [];
    for (const category of DATA_CATEGORIES) {
      if (!(await this.requiresConsent(tx, subject.employerLegalEntityId, category))) continue;
      const inForce = decisionInForce(await this.latestDay(tx, personId, category));
      if (!inForce || inForce.version < notice.version) ask.push(category);
    }
    return ask;
  }

  /**
   * The decisions made on the latest decision date, with the wording version each was made under. Only decisions
   * under the notices of the person's current employer count: consent given to a former employer is not consent.
   */
  private async latestDay(tx: Tx, personId: string, category: DataCategory): Promise<Decision[]> {
    const rows = await tx
      .select({ decision: consents.decision, decidedOn: consents.decidedOn, decidedAt: consents.decidedAt, version: privacyNotices.version })
      .from(consents)
      .innerJoin(privacyNotices, eq(privacyNotices.id, consents.noticeId))
      .innerJoin(people, and(eq(people.id, consents.personId), eq(people.employerLegalEntityId, privacyNotices.legalEntityId)))
      .where(and(eq(consents.personId, personId), eq(consents.category, category)))
      .orderBy(desc(consents.decidedOn));
    return rows.filter((row) => row.decidedOn === rows[0].decidedOn);
  }

  /**
   * Deletes every stored field of the category (CATEGORY_FIELDS). Contact consent covers optional contact details
   * (phone) only. The sign-in identity never relies on consent, so the account link, tenant access, roles and
   * permit duties stay (FR-PPL-005, D31); the guard below keeps that true even if a lawful basis ever allowed it.
   */
  private async deleteDependentData(
    tx: Tx,
    ctx: DbContext,
    personId: string,
    category: DataCategory,
    auditContext: Pick<AuditEvent, 'legalEntityId' | 'onBehalfOfPersonId'>,
  ): Promise<void> {
    if (category === 'sign_in') throw new Error('The sign-in identity never relies on consent and is never deleted by a withdrawal');
    const fields = CATEGORY_FIELDS[category];
    const cleared: string[] = [];
    if (fields.encrypted.length) {
      const rows = await tx
        .update(personPrivateData)
        .set(Object.fromEntries(fields.encrypted.map((field) => [FIELD_COLUMN[field], null])) as Partial<typeof personPrivateData.$inferInsert>)
        .where(eq(personPrivateData.personId, personId))
        .returning({ personId: personPrivateData.personId });
      if (rows.length) cleared.push(...fields.encrypted);
    }
    if (fields.people.length) {
      const rows = await tx
        .update(people)
        .set({ ...Object.fromEntries(fields.people.map((column) => [column, null])), updatedAt: new Date() } as Partial<typeof people.$inferInsert>)
        .where(eq(people.id, personId))
        .returning({ id: people.id });
      if (rows.length) cleared.push(...fields.people);
    }
    if (cleared.length) {
      await this.audit.record(tx, ctx, {
        ...auditContext,
        action: 'person.consent_data_deleted',
        entityType: 'person',
        entityId: personId,
        changedFields: cleared,
      });
    }
  }

  private async requireLegalEntityAdmin(tx: Tx, ctx: DbContext, legalEntityId: string): Promise<void> {
    if (!ctx.personId || !(await this.permissions.isLegalEntityAdmin(tx, ctx.personId, legalEntityId))) {
      throw new ForbiddenException("Only the employer's legal-entity admin can do this");
    }
  }
}
