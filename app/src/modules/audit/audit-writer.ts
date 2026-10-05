import { Injectable } from '@nestjs/common';
import type { DbContext, Tx } from '../../database/context';
import { auditEvents } from '../../database/schema';

/**
 * FR-AUD-005: fields whose values never reach audit. A change is recorded as "changed". Redaction fails closed:
 * the union of these names applies to every entity type, to camelCase spellings, and to any field that holds
 * one at any depth. Add the names of a new kind of personal value here.
 */
export const REDACTED_FIELDS: Record<string, readonly string[]> = {
  person: [
    'email', 'phone', 'blood_group', 'health_conditions', 'emergency_contacts', 'identity_document_number',
    'employment_history', 'full_name', 'designation',
  ],
};

/**
 * FR-AUD-005: secrets are recorded as "changed", never as values. Names are matched after camelCase is split and
 * every run of non-alphanumeric characters becomes `_`. A name is a secret when one of its `_` segments is in
 * SECRET_WORDS, or it equals a SECRET_NAMES entry, or it ends with `_` and an entry other than bare `key` or
 * `keys`, singular or plural (`sendgrid_api_key`, `private_keys`). `lock_key`, `lock_keys` and `lock_key_number` are
 * LOTO safety fields and keep their values, as do `pass` and `pin` names such as `gas_test_pass`. When a new kind
 * of secret appears, add its name here.
 */
const SECRET_WORDS = new Set([
  'password', 'passwd', 'pwd', 'passphrase', 'secret', 'token', 'credential', 'credentials', 'apikey', 'authorization',
  'bearer',
]);
const SECRET_NAMES = new Set([
  'key', 'keys', 'api_key', 'api_keys', 'private_key', 'secret_key', 'access_key', 'wrapped_key', 'data_key',
  'encryption_key', 'signing_key', 'master_key', 'hmac_key', 'kms_key', 'secrets', 'tokens', 'passwords',
]);

/**
 * Interim rule until counsel classifies the personal fields (O5): for these entity types, matched on the normalised
 * name (`people`, `Person`, `accounts`), only the IDs keep their values and every other field is recorded as
 * "changed". Relaxing it needs a PRD amendment.
 */
const PERSONAL_ENTITY = /^(person|people|account)s?$/;

const REDACTED = new Set(Object.values(REDACTED_FIELDS).flat());
/** `SMTPPassword` and `personID` split at the acronym boundary too; every run of other characters becomes `_`. */
const snake = (key: string): string =>
  key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
// A SECRET_NAMES entry, alone or after `_`, with an optional plural `s`. Bare `key` and `keys` only count as whole names.
const SECRET_SUFFIX = new RegExp(`(^|_)(${[...SECRET_NAMES].filter((n) => !/^keys?$/.test(n)).join('|')})s?$`);
const isSecret = (name: string): boolean =>
  SECRET_NAMES.has(name) || SECRET_SUFFIX.test(name) || name.split('_').some((word) => SECRET_WORDS.has(word));
const isRedacted = (key: string): boolean => REDACTED.has(snake(key)) || isSecret(snake(key));
const isId = (key: string): boolean => /(^|_)id$/.test(snake(key));
const holdsRedacted = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && Object.entries(value).some(([key, v]) => isRedacted(key) || holdsRedacted(v));

export type AuditChange = { before: unknown; after: unknown } | 'changed';

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string;
  legalEntityId?: string;
  onBehalfOfPersonId?: string;
  deviceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Fields that changed but whose values the caller does not pass. Always recorded as "changed". */
  changedFields?: readonly string[];
}

export function auditChanges(
  event: Pick<AuditEvent, 'entityType' | 'before' | 'after' | 'changedFields'>,
): Record<string, AuditChange> {
  const before = event.before ?? {};
  const after = event.after ?? {};
  const personal = PERSONAL_ENTITY.test(snake(event.entityType));
  const changes: Record<string, AuditChange> = {};
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const [was, now] = [before[field] ?? null, after[field] ?? null];
    if (JSON.stringify(was) === JSON.stringify(now)) continue;
    const redacted = (personal && !isId(field)) || isRedacted(field) || holdsRedacted(was) || holdsRedacted(now);
    changes[field] = redacted ? 'changed' : { before: was, after: now };
  }
  for (const field of event.changedFields ?? []) changes[field] = 'changed';
  return changes;
}

/** Writes in the caller's transaction: if the action rolls back, its audit event does too (FR-AUD-001 to 003). */
@Injectable()
export class AuditWriter {
  async record(tx: Tx, ctx: DbContext, event: AuditEvent): Promise<void> {
    if (!ctx.tenantId) throw new Error('An audit event needs a tenant context');
    await tx.insert(auditEvents).values({
      tenantId: ctx.tenantId,
      legalEntityId: event.legalEntityId ?? null,
      actorPersonId: ctx.personId,
      onBehalfOfPersonId: event.onBehalfOfPersonId ?? null,
      deviceId: event.deviceId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      changes: auditChanges(event),
    });
  }
}
